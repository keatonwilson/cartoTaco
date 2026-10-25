// src/lib/search.js
// Instant spot search: ranked, accent-insensitive, typo-tolerant matching over
// everything we know about a spot. Pure and model-free, so it runs on every
// keystroke in QuickSearch and backs the agent's search tool on the server.

import { hasValidCoordinates, salsaNames } from './siteModel.js';

// How much a hit in each field counts toward a spot's score
const FIELD_WEIGHTS = {
  name: 10,
  specialty: 5,
  style: 4,
  salsa: 4,
  protein: 4,
  menu: 3,
  region: 2,
  type: 2,
  address: 1.5,
  description: 1
};

// Match quality of a query token against a word
const EXACT = 1;
const PREFIX = 0.8;
const SUBSTRING = 0.6;
const FUZZY = 0.5;

// Dropped from a query only when something else is left to search for
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'with', 'in', 'at', 'of', 'for', 'near',
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en'
]);

// How we name the rows of the menu and protein tables to people
const MENU_LABELS = { dog: 'sonoran hot dog', plate: 'plate', snacks: 'snacks' };
// (with Spanish, since half of Tucson orders in it)
const PROTEIN_LABELS = {
  chicken: 'chicken pollo',
  beef: 'beef res',
  pork: 'pork cerdo puerco',
  fish: 'fish seafood mariscos pescado',
  veg: 'vegetarian veggie vegan'
};
const TYPE_LABELS = { 'Brick and Mortar': 'restaurant brick and mortar' };

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text) {
  const words = normalize(text).split(' ').filter(Boolean);
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  return meaningful.length > 0 ? meaningful : words;
}

/** Damerau-Levenshtein distance, giving up once it exceeds `max`. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      cur[j] = d;
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

// Typos allowed for a token: none for short words, where one edit turns
// "beef" into "reef" and every match into noise
function allowedTypos(token) {
  if (token.length >= 7) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

function matchWord(token, word) {
  if (word === token) return EXACT;
  // One letter is a whole word or nothing: "U of A" matched every "unique"
  if (token.length > 1 && word.startsWith(token)) return PREFIX;
  if (token.length >= 3 && word.includes(token)) return SUBSTRING;
  const typos = allowedTypos(token);
  if (typos > 0 && editDistance(token, word, typos) <= typos) return FUZZY;
  // A typo'd prefix while someone is still typing: "pastr" → "pastor"
  if (typos > 0 && word.length > token.length &&
      editDistance(token, word.slice(0, token.length), 1) <= 1) {
    return FUZZY;
  }
  return 0;
}

/**
 * The searchable text of a spot, by field. Each entry keeps its original
 * label so results can say what matched ("Specialty: Birria taco").
 */
function searchFields(site) {
  const raw = site.rawData || {};
  const fields = [];
  const add = (field, label, text = label) => {
    if (label) fields.push({ field, label: String(label), words: normalize(text).split(' ').filter(Boolean) });
  };

  add('name', site.name);
  for (const s of site.specialties || []) add('specialty', s.name);
  for (const styles of Object.values(site.proteinStyles || {})) {
    for (const style of styles) add('style', style);
  }
  for (const salsa of salsaNames(site)) add('salsa', salsa);
  for (const [key, value] of Object.entries(raw.protein || {})) {
    if (!key.endsWith('_yes') || value !== true) continue;
    const protein = key.slice(0, -4);
    add('protein', protein, PROTEIN_LABELS[protein] || protein);
  }
  for (const [key, value] of Object.entries(raw.menu || {})) {
    if (!key.endsWith('_yes') || value !== true) continue;
    const item = key.slice(0, -4);
    add('menu', item, MENU_LABELS[item] || item);
  }
  add('region', raw.descriptions?.region);
  add('type', site.type, TYPE_LABELS[site.type] || site.type);
  add('address', site.site?.address);
  add('description', site.shortDescription);
  add('description', site.longDescription);
  return fields;
}

// The fields are rebuilt only when the spots themselves change
const fieldCache = new WeakMap();
function cachedFields(site) {
  let fields = fieldCache.get(site);
  if (!fields) {
    fields = searchFields(site);
    fieldCache.set(site, fields);
  }
  return fields;
}

/**
 * Score one spot against query tokens. Every token has to match somewhere,
 * so adding words narrows the results the way people expect.
 *
 * @returns {{ score: number, matchedOn: { field: string, label: string } } | null}
 */
function scoreSite(site, tokens, phrase) {
  const fields = cachedFields(site);
  let score = 0;
  let best = null;

  for (const token of tokens) {
    let tokenBest = 0;
    let tokenField = null;
    for (const f of fields) {
      const weight = FIELD_WEIGHTS[f.field];
      for (const word of f.words) {
        const q = matchWord(token, word);
        if (q > 0 && q * weight > tokenBest) {
          tokenBest = q * weight;
          tokenField = f;
        }
      }
    }
    if (tokenBest === 0) return null;
    score += tokenBest;
    if (!best || tokenBest >= best.score) best = { score: tokenBest, field: tokenField };
  }

  // Whole-phrase bonuses, so "el guero canelo" beats spots matching each word apart
  const name = normalize(site.name);
  if (name === phrase) score += 20;
  else if (name.startsWith(phrase)) score += 10;
  else if (phrase.includes(' ') && name.includes(phrase)) score += 6;

  return { score, matchedOn: { field: best.field.field, label: best.field.label } };
}

/**
 * Search spots by free text.
 *
 * Unplaceable spots are skipped (a result flies the map to the spot). Closed
 * spots rank after open ones, so people learn a spot closed without it
 * crowding out places they can still go.
 *
 * @param {string} query
 * @param {Array} sites - processSite() spots
 * @param {{ limit?: number }} [options]
 * @returns {Array<{ site: object, score: number, matchedOn: { field: string, label: string } }>}
 */
export function searchSpots(query, sites, { limit = 8 } = {}) {
  const tokens = tokenize(query);
  if (tokens.length === 0 || !sites?.length) return [];
  const phrase = normalize(query);

  const results = [];
  for (const site of sites) {
    if (!hasValidCoordinates(site)) continue;
    const hit = scoreSite(site, tokens, phrase);
    if (hit) results.push({ site, ...hit });
  }

  results.sort((a, b) =>
    (a.site.isClosed ? 1 : 0) - (b.site.isClosed ? 1 : 0) ||
    b.score - a.score ||
    String(a.site.name).localeCompare(String(b.site.name))
  );
  return results.slice(0, limit);
}

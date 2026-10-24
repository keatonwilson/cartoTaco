// src/lib/intentRules.js
// Model-free intent parsing: turns "spicy pork open now, no trucks" into
// filterConfig changes. The free first tier of the concierge (a query this
// fully covers never reaches a model) and the "Filter the map" row in
// QuickSearch. English and Spanish.

import { normalize } from './search.js';

const PROTEIN_WORDS = {
  chicken: ['chicken', 'pollo'],
  beef: ['beef', 'res'],
  pork: ['pork', 'cerdo', 'puerco'],
  fish: ['fish', 'seafood', 'mariscos', 'pescado', 'shrimp', 'camaron', 'camarones'],
  veg: ['vegetarian', 'vegan', 'veggie', 'veg']
};

const TYPE_WORDS = {
  Truck: ['food trucks', 'food truck', 'trucks', 'truck', 'loncheras', 'lonchera'],
  Stand: ['stands', 'stand', 'carts', 'cart', 'puestos', 'puesto'],
  'Brick and Mortar': ['restaurants', 'restaurant', 'sit down', 'brick and mortar']
};
const ALL_TYPES = Object.keys(TYPE_WORDS);
const TYPE_NAMES = { Truck: 'trucks', Stand: 'stands', 'Brick and Mortar': 'restaurants' };

// Checked in order: the first spice phrase that matches wins
const SPICE_RULES = [
  { words: ['not spicy', 'no spice', 'not hot', 'no picante'], range: { min: 0, max: 4 } },
  { words: ['mild', 'suave'], range: { min: 0, max: 4 } },
  { words: ['very spicy', 'super spicy', 'extra hot', 'really hot', 'hottest', 'spiciest', 'muy picante'], range: { min: 8, max: 10 } },
  { words: ['spicy', 'hot', 'picante', 'picantes', 'picoso', 'picosos', 'enchiloso', 'heat'], range: { min: 7, max: 10 } }
];

const OPEN_WORDS = ['open now', 'open late', 'open', 'abierto', 'abiertos'];
const FAVORITE_WORDS = ['my favorites', 'my favourites', 'favorites', 'favourites', 'favs', 'mis favoritos'];
const HANDMADE_WORDS = ['handmade tortillas', 'handmade tortilla', 'homemade tortillas', 'handmade', 'tortillas a mano', 'hechas a mano'];
const NEGATIONS = ['no', 'not', 'without', 'except', 'sin', 'not a', 'no more'];

// Words that carry no meaning once the filters are pulled out
const FILLER = new Set([
  'i', 'im', 'me', 'my', 'we', 'want', 'wanna', 'need', 'looking', 'for', 'find', 'show', 'get',
  'where', 'can', 'some', 'something', 'anything', 'any', 'place', 'places', 'spot', 'spots',
  'that', 'thats', 'are', 'is', 'a', 'an', 'the', 'and', 'or', 'with', 'in', 'to', 'of', 'right',
  'taco', 'tacos', 'food', 'eat', 'good', 'best', 'please', 'now', 'today', 'tonight', 'quiero',
  'donde', 'hay', 'unos', 'algo', 'lugar', 'lugares', 'y', 'con', 'que', 'esta', 'estan'
]);

// "hot dog" is a menu item, not a spice level
const PROTECTED_PHRASES = ['hot dogs', 'hot dog', 'hotdog', 'hotdogs'];

/**
 * Find and remove a phrase from the padded text.
 * @returns {{ found: boolean, negated: boolean, text: string }}
 */
function take(text, phrase) {
  const re = new RegExp(`(?:\\b(${NEGATIONS.join('|')}) )?\\b${phrase}\\b`);
  const m = text.match(re);
  if (!m) return { found: false, negated: false, text };
  return { found: true, negated: !!m[1], text: text.replace(m[0], ' ') };
}

function takeAny(text, phrases) {
  for (const phrase of phrases) {
    const hit = take(text, phrase);
    if (hit.found) return { ...hit, phrase };
  }
  return { found: false, negated: false, text };
}

/**
 * Parse a query into filter changes.
 *
 * @param {string} query
 * @returns {{
 *   filters: object,     // partial filterConfig: only the keys the query set
 *   extras: object,      // slots filterConfig can't hold: handmadeTortillas, near
 *   matched: string[],   // human labels for what was understood
 *   remainder: string,   // what's left after filters and filler, normalized
 *   covered: boolean     // true when the filters say everything the query did
 * }}
 */
export function parseIntent(query) {
  let text = ` ${normalize(query)} `;
  const filters = {};
  const extras = {};
  const matched = [];

  // Pulled out first so the spice rules never see the "hot" in "hot dog"
  const protectedHits = [];
  for (const phrase of PROTECTED_PHRASES) {
    const hit = take(text, phrase);
    if (hit.found) {
      text = hit.text;
      protectedHits.push(phrase);
    }
  }

  // "near the U of A" — the rest of the query is the place
  const near = text.match(/\b(near|close to|by|around|cerca de)\b (.+)$/);
  if (near) {
    extras.near = near[2].trim();
    text = text.slice(0, near.index) + ' ';
    matched.push(`Near ${extras.near}`);
  }

  for (const [protein, words] of Object.entries(PROTEIN_WORDS)) {
    const hit = takeAny(text, words);
    if (!hit.found) continue;
    text = hit.text;
    if (hit.negated) continue; // "no pork" can't be expressed as a protein filter
    filters.proteins = { ...filters.proteins, [protein]: true };
    matched.push(protein === 'veg' ? 'Vegetarian' : protein[0].toUpperCase() + protein.slice(1));
  }

  const wantTypes = new Set();
  const avoidTypes = new Set();
  for (const [type, words] of Object.entries(TYPE_WORDS)) {
    const hit = takeAny(text, words);
    if (!hit.found) continue;
    text = hit.text;
    (hit.negated ? avoidTypes : wantTypes).add(type);
  }
  if (wantTypes.size || avoidTypes.size) {
    // Type filters include, so "no trucks" means "every other type"
    const types = wantTypes.size ? [...wantTypes] : ALL_TYPES.filter((t) => !avoidTypes.has(t));
    filters.types = Object.fromEntries(ALL_TYPES.map((t) => [t, types.includes(t)]));
    const names = (list) => list.map((t) => TYPE_NAMES[t]).join(' or ');
    const label = wantTypes.size ? names(types) : `No ${names([...avoidTypes])}`;
    matched.push(label.charAt(0).toUpperCase() + label.slice(1));
  }

  for (const rule of SPICE_RULES) {
    const hit = takeAny(text, rule.words);
    if (!hit.found) continue;
    text = hit.text;
    filters.spiceLevel = hit.negated ? { min: 0, max: 4 } : rule.range;
    const { min, max } = filters.spiceLevel;
    matched.push(max < 10 ? `Spice ≤ ${max}` : `Spice ${min}+`);
    break;
  }

  const open = takeAny(text, OPEN_WORDS);
  if (open.found && !open.negated) {
    text = open.text;
    filters.openNow = true;
    matched.push('Open now');
  }

  const favs = takeAny(text, FAVORITE_WORDS);
  if (favs.found && !favs.negated) {
    text = favs.text;
    filters.showFavoritesOnly = true;
    matched.push('Favorites');
  }

  const handmade = takeAny(text, HANDMADE_WORDS);
  if (handmade.found && !handmade.negated) {
    text = handmade.text;
    extras.handmadeTortillas = true;
    matched.push('Handmade tortillas');
  }

  const leftover = text
    .split(' ')
    .filter((w) => w && !FILLER.has(w) && !NEGATIONS.includes(w));
  const remainder = [...protectedHits, ...leftover].join(' ');

  return {
    filters,
    extras,
    matched,
    remainder,
    covered: matched.length > 0 && remainder === ''
  };
}

/** filterConfig with a parsed intent's filters applied over it. */
export function applyIntentFilters(cfg, filters) {
  return {
    ...cfg,
    ...filters,
    proteins: filters.proteins ? { ...cfg.proteins, ...filters.proteins } : cfg.proteins,
    types: filters.types ? { ...cfg.types, ...filters.types } : cfg.types
  };
}

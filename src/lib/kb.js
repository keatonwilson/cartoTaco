// src/lib/kb.js
// The culinary knowledgebase (cocina) as the concierge reads it: published
// cards, every fact backed by credited sources. Pure, so the server (live
// cards, src/lib/server/kb.js) and the evals (a pinned snapshot) share it.
import { normalize, editDistance } from './search.js';

/** A cocina snapshot (one card per JSONL line) → cards. */
export function parseSnapshot(text) {
  return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
}

/**
 * The card for a food name: its name or an alias, exactly or within a typo
 * (1 from 4 letters, 2 from 7, as searchSpots allows). Closest wins.
 */
export function findEntry(cards, name) {
  const q = normalize(name);
  if (!q) return null;
  const typos = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  let best = null;
  for (const card of cards) {
    for (const label of [card.name, ...card.aliases]) {
      const d = editDistance(q, normalize(label), typos);
      if (d <= typos && (!best || d < best.d)) best = { card, d };
    }
  }
  return best?.card ?? null;
}

const workKey = (s) => s.url || `${s.publisher}|${s.title}`;
// Credit by person where the work names one, else by publisher. The URL becomes
// a link in the chat, so only http(s) gets through
const credit = (s) => ({
  by: s.authors?.length ? s.authors.join(', ') : s.publisher,
  title: s.title,
  url: /^https?:\/\//i.test(s.url ?? '') ? s.url : null
});

/** Every work a card relies on, once each, for the reply's Sources line. */
export function credits(card) {
  const works = new Map();
  for (const claim of card.claims) {
    for (const s of claim.sources) if (!works.has(workKey(s))) works.set(workKey(s), credit(s));
  }
  return [...works.values()];
}

/** A card, compact for the model: facts point at numbered sources. */
export function describeEntry(card) {
  const works = new Map(); // work key → { n, by, title, url }
  const ref = (s) => {
    const k = workKey(s);
    if (!works.has(k)) works.set(k, { n: works.size + 1, ...credit(s) });
    return works.get(k).n;
  };
  const facts = card.claims.map((c) => ({
    fact: c.predicate,
    value: c.object ? `${c.value} (${c.object.name})` : c.value,
    sources: c.sources.map(ref)
  }));
  return { name: card.name, kind: card.kind, other_names: card.aliases, facts, sources: [...works.values()] };
}

/** A card's writeup for a spot card: its sentences, credited to the works behind the claims they cite. */
export function writeupEntry(card) {
  if (!card.writeup?.length) return null;
  const cited = new Set(card.writeup.flatMap((s) => s.claims));
  return {
    name: card.name,
    slug: card.slug,
    sentences: card.writeup.map((s) => s.text),
    sources: credits({ claims: card.claims.filter((c) => cited.has(c.id)) })
  };
}

/** Writeups by slug, plus every name and alias (normalized) → slug, for exact lookups. */
export function writeupIndex(cards) {
  const entries = {};
  const names = {};
  for (const card of cards) {
    const entry = writeupEntry(card);
    if (!entry) continue;
    entries[card.slug] = entry;
    for (const n of [card.name, ...card.aliases]) names[normalize(n)] ??= card.slug;
  }
  return { entries, names };
}

/**
 * A specialty's writeup: its name exactly (normalized), never a near miss, so a
 * spot card never borrows another food's description.
 */
export function writeupFor(index, name) {
  const slug = index?.names?.[normalize(name)];
  return slug ? index.entries[slug] : null;
}

// src/lib/similarity.js
// Description similarity between spots. cartoTacoMenuExtract's
// src/similarity.py embeds each spot's hand-written descriptions and writes
// every pairwise cosine score to site_similarity (migration 042); this module
// turns those rows into "Similar spots" and the text half of the taste-profile
// recommendations. Pure (no stores), like recommend.js.
//
// Raw cosine scores from one author's prose sit in a narrow band (all pairs
// might fall between 0.75 and 0.9), so nothing here shows them as a "% match".
// Rankings use them as-is; the recommender rescales each favourite's row over
// the candidates first (min-max), so "closest of the bunch" scores 1.

import { hasValidCoordinates } from './siteModel.js';

/**
 * @param {Array<{est_id_a: number, est_id_b: number, score: number}>} rows
 * @returns {Map<number, Map<number, number>>} symmetric score lookup
 */
export function buildSimilarityIndex(rows) {
	const index = new Map();
	const put = (a, b, s) => {
		if (!index.has(a)) index.set(a, new Map());
		index.get(a).set(b, s);
	};
	for (const r of rows || []) {
		if (r.est_id_a === r.est_id_b || typeof r.score !== 'number') continue;
		put(r.est_id_a, r.est_id_b, r.score);
		put(r.est_id_b, r.est_id_a, r.score);
	}
	return index;
}

/** Spots that can be suggested: open, vetted, on the map. */
export function isSuggestable(site) {
	return !!site && !site.isPending && !site.isClosed && hasValidCoordinates(site);
}

/**
 * The spots whose descriptions read most like this one's. Works for a closed
 * spot too ("if you miss this one"); only open, vetted spots come back.
 * @returns {Array<{site: object, score: number}>} most similar first
 */
export function similarSpots(index, estId, catalog, k = 3) {
	const row = index?.get(estId);
	if (!row) return [];
	return (catalog || [])
		.filter((s) => s.est_id !== estId && isSuggestable(s) && row.has(s.est_id))
		.map((site) => ({ site, score: row.get(site.est_id) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, k);
}

/**
 * Text affinity of each candidate to a set of favourites: for every favourite,
 * rescale its scores over the candidates to 0–1, then take the best favourite
 * per candidate. Best-match rather than an average, so someone who loves a
 * cocktail bar and a hot dog cart gets spots like either, not like neither.
 * @returns {Map<number, {score: number, because: object}>} est_id → affinity, empty without data
 */
export function textAffinities(index, favourites, candidates) {
	const out = new Map();
	if (!index || index.size === 0) return out;
	for (const fav of favourites) {
		const row = index.get(fav.est_id);
		if (!row) continue;
		const scored = candidates.filter((c) => row.has(c.est_id));
		if (scored.length === 0) continue;
		const vals = scored.map((c) => row.get(c.est_id));
		const min = Math.min(...vals);
		const span = Math.max(...vals) - min;
		for (const c of scored) {
			const score = span > 0 ? (row.get(c.est_id) - min) / span : 1;
			const prev = out.get(c.est_id);
			if (!prev || score > prev.score) out.set(c.est_id, { score, because: fav });
		}
	}
	return out;
}

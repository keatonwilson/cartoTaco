// src/lib/recommend.js
// k-NN taste recommendations: spots nearest the centre of a user's favourites.
// Pure (no stores), so tasteProfileStore and the concierge share it.
import { AXES, salsaAffinity } from './salsa.js';
import { computeSummaryStats } from './siteModel.js';

const K = 5;

export function buildFeatureVector(site, maxSalsa) {
	const items = site.topFiveProteinItems || [];
	const values = site.topFiveProteinValues || [];
	const total = values.reduce((a, b) => a + b, 0) || 1;
	const pmap = {};
	for (let i = 0; i < items.length; i++) {
		const key = items[i]?.toLowerCase();
		if (key) pmap[key] = (values[i] || 0) / total;
	}
	return [
		pmap.chicken || 0,
		pmap.beef    || 0,
		pmap.pork    || 0,
		pmap.fish    || 0,
		pmap.veg     || 0,
		(site.heatOverall || 0) / 10,
		maxSalsa > 0 ? (site.salsaCount || 0) / maxSalsa : 0
	];
}

function euclideanDistance(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
	return Math.sqrt(sum);
}

export function centroid(vectors) {
	if (vectors.length === 0) return [];
	const dims = vectors[0].length;
	const result = new Array(dims).fill(0);
	for (const v of vectors) for (let i = 0; i < dims; i++) result[i] += v[i];
	return result.map(x => x / vectors.length);
}

// Each favourited salsa a spot actually serves pulls it this much closer (up to two)
const SERVES_FAVOURITE_PULL = 0.85;

// How much description similarity counts: the text affinity joins the
// distance as one more axis of this length (0 = closest of the candidates to
// one of your favourites, TEXT_WEIGHT = furthest). Tuning knob.
export const TEXT_WEIGHT = 0.6;

/**
 * Nearest spots to the user's taste. With favourite salsas, the 7 spot
 * dimensions are joined by how close the spot's salsas come to the user's
 * salsa taste (see salsaAffinity), and serving a favourite outright pulls a
 * spot closer still. Without any, this is the original 7-dimension k-NN.
 *
 * With `textAffinity` (from similarity.js textAffinities), how closely a
 * spot's description reads like one of the favourites' joins as one more
 * axis, and the favourite it reads like comes back as `because`. Spots
 * without a score (not yet computed) sit at the far end of that axis.
 */
export function knnRecommend(targetVector, candidates, maxSalsa, favouriteSalsas, k = K, { textAffinity = null } = {}) {
	const withSalsas = favouriteSalsas.length > 0;
	const withText = textAffinity?.size > 0;
	const MAX_DIST = Math.sqrt((withSalsas ? 7 + AXES.length : 7) + (withText ? TEXT_WEIGHT ** 2 : 0));
	return candidates
		.map(site => {
			const fv = buildFeatureVector(site, maxSalsa);
			let dist = euclideanDistance(targetVector, fv);
			const text = withText ? textAffinity.get(site.est_id) : null;
			if (withText) dist = Math.hypot(dist, TEXT_WEIGHT * (1 - (text?.score ?? 0)));
			const affinity = salsaAffinity(site.salsaStyles, favouriteSalsas);
			if (affinity) {
				dist = Math.hypot(dist, affinity.distance) * SERVES_FAVOURITE_PULL ** Math.min(affinity.matched.length, 2);
			}
			const similarity = Math.round(Math.max(0, (1 - dist / MAX_DIST)) * 100);
			return { site, dist, similarity, matchedSalsas: affinity?.matched ?? [], because: text?.because ?? null };
		})
		.sort((a, b) => a.dist - b.dist)
		.slice(0, k)
		.map(({ site, similarity, matchedSalsas, because }) => ({ ...site, similarity, matchedSalsas, because }));
}

/**
 * Spots a user would like, from their favourite spots (and salsas, if any).
 * Pending and closed spots are never recommended.
 * @returns {Array<object>|null} sites with `similarity` (0-100) and `matchedSalsas`, or null without usable favourites
 */
export function recommendFor(catalog, favIds, { favouriteSalsas = [], k = K } = {}) {
  const sites = catalog.filter((s) => !s.isPending && !s.isClosed);
  const favs = sites.filter((s) => favIds.has(s.est_id));
  if (!favs.length) return null;
  const maxSalsa = computeSummaryStats(catalog).maxSalsaNum || 10;
  const target = centroid(favs.map((s) => buildFeatureVector(s, maxSalsa)));
  return knnRecommend(target, sites.filter((s) => !favIds.has(s.est_id)), maxSalsa, favouriteSalsas, k);
}

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

/**
 * Nearest spots to the user's taste. With favourite salsas, the 7 spot
 * dimensions are joined by how close the spot's salsas come to the user's
 * salsa taste (see salsaAffinity), and serving a favourite outright pulls a
 * spot closer still. Without any, this is the original 7-dimension k-NN.
 */
export function knnRecommend(targetVector, candidates, maxSalsa, favouriteSalsas, k = K) {
	const withSalsas = favouriteSalsas.length > 0;
	const MAX_DIST = Math.sqrt(withSalsas ? 7 + AXES.length : 7);
	return candidates
		.map(site => {
			const fv = buildFeatureVector(site, maxSalsa);
			let dist = euclideanDistance(targetVector, fv);
			const affinity = salsaAffinity(site.salsaStyles, favouriteSalsas);
			if (affinity) {
				dist = Math.hypot(dist, affinity.distance) * SERVES_FAVOURITE_PULL ** Math.min(affinity.matched.length, 2);
			}
			const similarity = Math.round(Math.max(0, (1 - dist / MAX_DIST)) * 100);
			return { site, dist, similarity, matchedSalsas: affinity?.matched ?? [] };
		})
		.sort((a, b) => a.dist - b.dist)
		.slice(0, k)
		.map(({ site, similarity, matchedSalsas }) => ({ ...site, similarity, matchedSalsas }));
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

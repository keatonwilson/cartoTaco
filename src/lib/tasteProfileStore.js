// src/lib/tasteProfileStore.js
// Derives a personal taste profile from user's favorited spots using k-NN

import { derived } from 'svelte/store';
import { favoriteIds } from './favoritesStore';
import { processedTacoData, summaryStats } from './stores';

const K = 5; // number of recommendations

// Archetype definitions based on dominant traits
const ARCHETYPES = [
	{ id: 'heat_seeker', label: 'Heat Seeker', desc: 'You live for the burn', test: p => p.avgSpice >= 7 },
	{ id: 'salsa_explorer', label: 'Salsa Explorer', desc: 'The more salsas, the better', test: p => p.avgSalsaCount >= 5 },
	{ id: 'the_purist', label: 'The Purist', desc: 'You know what you like and stick to it', test: p => p.dominantProteinPct >= 60 },
	{ id: 'adventurer', label: 'The Adventurer', desc: 'Variety is the spice of life', test: p => p.proteinDiversity >= 4 },
	{ id: 'street_food_fan', label: 'Street Food Fan', desc: 'Trucks and stands are your jam', test: p => p.typePrefs.truck > 0.4 || p.typePrefs.stand > 0.4 },
	{ id: 'taco_enthusiast', label: 'Taco Enthusiast', desc: 'You appreciate every style of taco', test: () => true }
];

/**
 * Build a normalized feature vector for a site:
 * [chicken, beef, pork, fish, veg, heat, salsa] all in [0,1]
 */
function buildFeatureVector(site, maxSalsa) {
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
		pmap.beef || 0,
		pmap.pork || 0,
		pmap.fish || 0,
		pmap.veg || 0,
		(site.heatOverall || 0) / 10,
		maxSalsa > 0 ? (site.salsaCount || 0) / maxSalsa : 0
	];
}

function euclideanDistance(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		sum += diff * diff;
	}
	return Math.sqrt(sum);
}

/**
 * Compute the centroid (mean vector) of an array of vectors
 */
function centroid(vectors) {
	if (vectors.length === 0) return [];
	const dims = vectors[0].length;
	const result = new Array(dims).fill(0);
	for (const v of vectors) {
		for (let i = 0; i < dims; i++) result[i] += v[i];
	}
	return result.map(x => x / vectors.length);
}

/**
 * k-NN: find the K closest sites to the target vector
 * Returns sites annotated with similarity (0-100)
 */
function knnRecommend(targetVector, candidates, maxSalsa) {
	const MAX_DIST = Math.sqrt(7); // max Euclidean distance in 7-dim unit space

	return candidates
		.map(site => {
			const fv = buildFeatureVector(site, maxSalsa);
			const dist = euclideanDistance(targetVector, fv);
			const similarity = Math.round(Math.max(0, (1 - dist / MAX_DIST)) * 100);
			return { site, dist, similarity };
		})
		.sort((a, b) => a.dist - b.dist)
		.slice(0, K)
		.map(({ site, similarity }) => ({ ...site, similarity }));
}

/**
 * Derive a taste profile from favorited site data
 */
export const tasteProfile = derived(
	[favoriteIds, processedTacoData, summaryStats],
	([$favoriteIds, $processedTacoData, $summaryStats]) => {
		if (!$favoriteIds || $favoriteIds.size === 0 || !$processedTacoData || $processedTacoData.length === 0) {
			return null;
		}

		const favSites = $processedTacoData.filter(s => $favoriteIds.has(s.est_id));
		if (favSites.length === 0) return null;

		const maxSalsa = $summaryStats.maxSalsaNum || 10;

		// --- Build feature vectors for all favorited sites ---
		const favVectors = favSites.map(s => buildFeatureVector(s, maxSalsa));
		const userVector = centroid(favVectors);

		// --- Protein affinities (from user vector dims 0-4) ---
		const proteinKeys = ['chicken', 'beef', 'pork', 'fish', 'veg'];
		const rawProtein = proteinKeys.map((_, i) => userVector[i] || 0);
		const proteinSum = rawProtein.reduce((a, b) => a + b, 0) || 1;
		const proteinAffinities = {};
		for (let i = 0; i < proteinKeys.length; i++) {
			proteinAffinities[proteinKeys[i]] = Math.round((rawProtein[i] / proteinSum) * 100);
		}

		const sortedProteins = Object.entries(proteinAffinities).sort((a, b) => b[1] - a[1]);
		const dominantProtein = sortedProteins[0]?.[0] || 'chicken';
		const dominantProteinPct = sortedProteins[0]?.[1] || 0;
		const proteinDiversity = sortedProteins.filter(([, pct]) => pct > 10).length;

		// --- Spice & salsa (from user vector dims 5-6) ---
		const avgSpice = Math.round((userVector[5] || 0) * 10 * 10) / 10;
		const avgSalsaCount = Math.round((userVector[6] || 0) * maxSalsa * 10) / 10;

		// --- Type preferences ---
		const typeCounts = { 'Brick and Mortar': 0, Stand: 0, Truck: 0 };
		for (const site of favSites) {
			if (site.type && site.type in typeCounts) typeCounts[site.type]++;
		}
		const typeTotal = favSites.length;
		const typePrefs = {
			restaurant: typeTotal > 0 ? typeCounts['Brick and Mortar'] / typeTotal : 0,
			stand: typeTotal > 0 ? typeCounts.Stand / typeTotal : 0,
			truck: typeTotal > 0 ? typeCounts.Truck / typeTotal : 0
		};

		// --- Archetype ---
		const profileData = { avgSpice, avgSalsaCount, dominantProteinPct, proteinDiversity, typePrefs };
		const archetype = ARCHETYPES.find(a => a.test(profileData)) || ARCHETYPES[ARCHETYPES.length - 1];

		// --- k-NN recommendations ---
		const nonFavSites = $processedTacoData.filter(s => !$favoriteIds.has(s.est_id));
		const recommendations = knnRecommend(userVector, nonFavSites, maxSalsa);

		// --- Scatter data for visualization ---
		// Each site: { name, heat, salsa, isFav, isRec, similarity }
		const recIds = new Set(recommendations.map(r => r.est_id));
		const scatterPoints = $processedTacoData.map(site => ({
			est_id: site.est_id,
			name: site.name,
			heat: site.heatOverall || 0,
			salsa: site.salsaCount || 0,
			isFav: $favoriteIds.has(site.est_id),
			isRec: recIds.has(site.est_id),
			similarity: recommendations.find(r => r.est_id === site.est_id)?.similarity ?? null
		}));

		// User centroid in heat/salsa space
		const userHeat = avgSpice;
		const userSalsa = avgSalsaCount;

		return {
			favoritesCount: favSites.length,
			userVector,
			proteinAffinities,
			dominantProtein,
			dominantProteinPct,
			proteinDiversity,
			avgSpice,
			avgSalsaCount,
			typePrefs,
			archetype,
			recommendations,
			scatterPoints,
			userHeat,
			userSalsa
		};
	}
);

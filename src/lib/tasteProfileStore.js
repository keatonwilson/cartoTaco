// src/lib/tasteProfileStore.js
// Derives a personal taste profile from user's favorited spots using k-NN

import { derived } from 'svelte/store';
import { favoriteIds } from './favoritesStore';
import { processedTacoData, summaryStats } from './stores';

const K = 5; // number of k-NN recommendations

// ─── Data-driven thresholds ───────────────────────────────────────────────────

function pct(sorted, p) {
	if (sorted.length === 0) return 0;
	return sorted[Math.floor((p / 100) * (sorted.length - 1))];
}

function computeThresholds(allSites) {
	const heats = allSites.map(s => s.heatOverall || 0).filter(v => v > 0).sort((a, b) => a - b);
	const salsas = allSites.map(s => s.salsaCount || 0).filter(v => v > 0).sort((a, b) => a - b);
	return {
		heat:  { p25: pct(heats, 25),  p50: pct(heats, 50),  p75: pct(heats, 75)  },
		salsa: { p25: pct(salsas, 25), p50: pct(salsas, 50), p75: pct(salsas, 75) }
	};
}

// ─── Scoring primitives (all return 0–100) ────────────────────────────────────

/** Maps a value against p25/p50/p75 to a 0–100 score. */
function scoreQuartile(value, { p25, p50, p75 }, max) {
	if (value <= 0) return 0;
	if (value <= p25) return (value / (p25 || 1)) * 20;
	if (value <= p50) return 20 + ((value - p25) / Math.max(p50 - p25, 0.1)) * 30;
	if (value <= p75) return 50 + ((value - p50) / Math.max(p75 - p50, 0.1)) * 30;
	return Math.min(100, 80 + ((value - p75) / Math.max((max || p75 * 1.5) - p75, 0.1)) * 20);
}

function scoreHeat(avgSpice, t)       { return scoreQuartile(avgSpice, t.heat, 10); }
function scoreSalsa(avgSalsa, t)      { return scoreQuartile(avgSalsa, t.salsa, 20); }
function scoreMildness(avgSpice, t)   { return 100 - scoreHeat(avgSpice, t); }

/** How dominant the user's #1 protein is (40 % → 0, 80 %+ → 100). */
function scoreDominance(dominantPct) {
	return Math.max(0, Math.min(100, (dominantPct - 40) / 40 * 100));
}

/** How many proteins the user engages with (1 → 0, 5 → 100). */
function scoreDiversity(diversity) {
	return Math.max(0, Math.min(100, (diversity - 1) / 4 * 100));
}

/** Preference for trucks + stands. */
function scoreStreet(typePrefs) {
	return Math.min(100, (typePrefs.truck + typePrefs.stand) * 100);
}

/** Preference for brick-and-mortar. */
function scoreRestaurant(typePrefs) {
	return Math.min(100, typePrefs.restaurant * 100);
}

/**
 * Shannon entropy across spot types — rewards an even spread.
 * 33/33/33 → 100, 50/50/0 → ~73, 100/0/0 → 0.
 */
function scoreVariedType(typePrefs) {
	const shares = [typePrefs.restaurant, typePrefs.stand, typePrefs.truck].filter(s => s > 0);
	if (shares.length <= 1) return 0;
	const entropy = -shares.reduce((sum, p) => sum + p * Math.log(p), 0);
	return Math.min(100, (entropy / Math.log(3)) * 100);
}

/**
 * Geometric mean — all components must be strong.
 * If any component is 0 the result is 0.
 */
function geo(...scores) {
	if (scores.some(s => s <= 0)) return 0;
	const product = scores.reduce((a, b) => a * (Math.min(100, b) / 100), 1);
	return Math.pow(product, 1 / scores.length) * 100;
}

// ─── Archetype definitions ────────────────────────────────────────────────────

const ARCHETYPES = [
	// ── Single-trait ────────────────────────────────────────────────────────
	{
		id: 'heat_seeker',
		label: 'Heat Seeker',
		desc: 'You live for the burn — the hotter the better',
		score: (p, t) => scoreHeat(p.avgSpice, t) * 0.85 + scoreDiversity(p.proteinDiversity) * 0.15
	},
	{
		id: 'salsa_explorer',
		label: 'Salsa Explorer',
		desc: 'The more options the better — you want ALL the salsas',
		score: (p, t) => scoreSalsa(p.avgSalsaCount, t) * 0.80 + scoreDiversity(p.proteinDiversity) * 0.20
	},
	{
		id: 'the_purist',
		label: 'The Purist',
		desc: 'You know exactly what you like and you stick to it',
		score: (p, t) => scoreDominance(p.dominantProteinPct) * 0.80 + (100 - scoreDiversity(p.proteinDiversity)) * 0.20
	},
	{
		id: 'adventurer',
		label: 'The Adventurer',
		desc: 'Variety is the spice of life — you try everything',
		score: (p, t) => scoreDiversity(p.proteinDiversity) * 0.65 + scoreSalsa(p.avgSalsaCount, t) * 0.35
	},
	{
		id: 'street_food_fan',
		label: 'Street Food Fan',
		desc: 'Trucks and stands are where the real tacos are at',
		score: (p, t) => scoreStreet(p.typePrefs)
	},

	// ── Combination ──────────────────────────────────────────────────────────
	{
		id: 'street_fire',
		label: 'Street Fire',
		desc: 'Spicy street food is your element — heat from a truck hits different',
		score: (p, t) => geo(scoreHeat(p.avgSpice, t), scoreStreet(p.typePrefs))
	},
	{
		id: 'connoisseur',
		label: 'The Connoisseur',
		desc: 'You appreciate it all — diverse proteins, loads of salsa, every spot type',
		score: (p, t) => (scoreDiversity(p.proteinDiversity) + scoreSalsa(p.avgSalsaCount, t) + scoreVariedType(p.typePrefs)) / 3
	},
	{
		id: 'spicy_purist',
		label: 'Spicy Purist',
		desc: 'One protein, maximum heat — you know your order before you arrive',
		score: (p, t) => geo(scoreHeat(p.avgSpice, t), scoreDominance(p.dominantProteinPct))
	},
	{
		id: 'minimalist',
		label: 'The Minimalist',
		desc: 'Simple, consistent, perfected — why complicate a good thing?',
		score: (p, t) => geo(scoreDominance(p.dominantProteinPct), scoreMildness(p.avgSpice, t), 100 - scoreSalsa(p.avgSalsaCount, t))
	},
	{
		id: 'mild_explorer',
		label: 'The Mild Explorer',
		desc: 'All the variety, none of the burn — you explore the full menu on your own terms',
		score: (p, t) => geo(scoreDiversity(p.proteinDiversity), scoreSalsa(p.avgSalsaCount, t), scoreMildness(p.avgSpice, t))
	},
	{
		id: 'salsa_purist',
		label: 'Salsa Purist',
		desc: 'Ten salsas, one protein — maximum choice for your one true order',
		score: (p, t) => geo(scoreSalsa(p.avgSalsaCount, t), scoreDominance(p.dominantProteinPct))
	},
	{
		id: 'loyalist',
		label: 'The Loyalist',
		desc: 'You have your spot, your order, and you don\'t need to wander',
		score: (p, t) => scoreRestaurant(p.typePrefs) * 0.55 + scoreDominance(p.dominantProteinPct) * 0.45
	},

	// ── Fallback ─────────────────────────────────────────────────────────────
	{
		id: 'taco_enthusiast',
		label: 'Taco Enthusiast',
		desc: 'Balanced, curious, and always up for a good taco',
		score: () => 15 // guaranteed floor so something always wins
	}
];

// ─── k-NN helpers ─────────────────────────────────────────────────────────────

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

function centroid(vectors) {
	if (vectors.length === 0) return [];
	const dims = vectors[0].length;
	const result = new Array(dims).fill(0);
	for (const v of vectors) for (let i = 0; i < dims; i++) result[i] += v[i];
	return result.map(x => x / vectors.length);
}

function knnRecommend(targetVector, candidates, maxSalsa) {
	const MAX_DIST = Math.sqrt(7);
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

// ─── Main derived store ───────────────────────────────────────────────────────

export const tasteProfile = derived(
	[favoriteIds, processedTacoData, summaryStats],
	([$favoriteIds, $processedTacoData, $summaryStats]) => {
		if (!$favoriteIds || $favoriteIds.size === 0 || !$processedTacoData || $processedTacoData.length === 0) {
			return null;
		}

		const favSites = $processedTacoData.filter(s => $favoriteIds.has(s.est_id));
		if (favSites.length === 0) return null;

		const maxSalsa = $summaryStats.maxSalsaNum || 10;

		// Feature vectors + user centroid
		const favVectors = favSites.map(s => buildFeatureVector(s, maxSalsa));
		const userVector = centroid(favVectors);

		// Protein affinities from centroid dims 0–4
		const proteinKeys = ['chicken', 'beef', 'pork', 'fish', 'veg'];
		const rawProtein = proteinKeys.map((_, i) => userVector[i] || 0);
		const proteinSum = rawProtein.reduce((a, b) => a + b, 0) || 1;
		const proteinAffinities = {};
		for (let i = 0; i < proteinKeys.length; i++) {
			proteinAffinities[proteinKeys[i]] = Math.round((rawProtein[i] / proteinSum) * 100);
		}

		const sortedProteins = Object.entries(proteinAffinities).sort((a, b) => b[1] - a[1]);
		const dominantProtein    = sortedProteins[0]?.[0] || 'chicken';
		const dominantProteinPct = sortedProteins[0]?.[1] || 0;
		const proteinDiversity   = sortedProteins.filter(([, pct]) => pct > 10).length;

		// Spice & salsa from centroid dims 5–6
		const avgSpice      = Math.round((userVector[5] || 0) * 10 * 10) / 10;
		const avgSalsaCount = Math.round((userVector[6] || 0) * maxSalsa * 10) / 10;

		// Type preferences
		const typeCounts = { 'Brick and Mortar': 0, Stand: 0, Truck: 0 };
		for (const site of favSites) {
			if (site.type && site.type in typeCounts) typeCounts[site.type]++;
		}
		const typeTotal = favSites.length;
		const typePrefs = {
			restaurant: typeTotal > 0 ? typeCounts['Brick and Mortar'] / typeTotal : 0,
			stand:      typeTotal > 0 ? typeCounts.Stand / typeTotal : 0,
			truck:      typeTotal > 0 ? typeCounts.Truck  / typeTotal : 0
		};

		// Data-driven thresholds from entire dataset
		const thresholds = computeThresholds($processedTacoData);

		// Score every archetype, sort descending
		const profileData = { avgSpice, avgSalsaCount, dominantProteinPct, proteinDiversity, typePrefs };
		const scoredArchetypes = ARCHETYPES
			.map(a => ({ ...a, finalScore: Math.round(a.score(profileData, thresholds)) }))
			.sort((a, b) => b.finalScore - a.finalScore);

		const archetype  = scoredArchetypes[0];
		// Runner-up: only show if it scored meaningfully (above fallback floor)
		const runnerUp   = scoredArchetypes[1]?.finalScore > 20 ? scoredArchetypes[1] : null;

		// k-NN recommendations
		const nonFavSites   = $processedTacoData.filter(s => !$favoriteIds.has(s.est_id));
		const recommendations = knnRecommend(userVector, nonFavSites, maxSalsa);

		// Scatter data for visualization
		const recIds = new Set(recommendations.map(r => r.est_id));
		const scatterPoints = $processedTacoData.map(site => ({
			est_id:     site.est_id,
			name:       site.name,
			heat:       site.heatOverall || 0,
			salsa:      site.salsaCount  || 0,
			isFav:      $favoriteIds.has(site.est_id),
			isRec:      recIds.has(site.est_id),
			similarity: recommendations.find(r => r.est_id === site.est_id)?.similarity ?? null
		}));

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
			runnerUp,
			thresholds,
			recommendations,
			scatterPoints,
			userHeat:  avgSpice,
			userSalsa: avgSalsaCount
		};
	}
);

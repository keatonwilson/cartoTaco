// src/lib/tasteProfileStore.js
// Derives a personal taste profile from user's favorited spots

import { derived } from 'svelte/store';
import { favoriteIds } from './favoritesStore';
import { processedTacoData } from './stores';

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
 * Derive a taste profile from favorited site data
 */
export const tasteProfile = derived(
	[favoriteIds, processedTacoData],
	([$favoriteIds, $processedTacoData]) => {
		if (!$favoriteIds || $favoriteIds.size === 0 || !$processedTacoData || $processedTacoData.length === 0) {
			return null;
		}

		// Get favorited sites
		const favSites = $processedTacoData.filter(s => $favoriteIds.has(s.est_id));
		if (favSites.length === 0) return null;

		// --- Protein affinities ---
		const proteinTotals = { chicken: 0, beef: 0, pork: 0, fish: 0, veg: 0 };
		let proteinSiteCount = 0;

		for (const site of favSites) {
			const items = site.topFiveProteinItems || [];
			const values = site.topFiveProteinValues || [];
			if (items.length === 0) continue;
			proteinSiteCount++;
			for (let i = 0; i < items.length; i++) {
				const key = items[i]?.toLowerCase();
				if (key && key in proteinTotals) {
					proteinTotals[key] += (values[i] || 0);
				}
			}
		}

		// Normalize to percentages
		const proteinTotal = Object.values(proteinTotals).reduce((a, b) => a + b, 0);
		const proteinAffinities = {};
		for (const [key, val] of Object.entries(proteinTotals)) {
			proteinAffinities[key] = proteinTotal > 0 ? Math.round((val / proteinTotal) * 100) : 0;
		}

		// Dominant protein
		const sortedProteins = Object.entries(proteinAffinities).sort((a, b) => b[1] - a[1]);
		const dominantProtein = sortedProteins[0]?.[0] || 'chicken';
		const dominantProteinPct = sortedProteins[0]?.[1] || 0;

		// Protein diversity (count of proteins with >10% share)
		const proteinDiversity = sortedProteins.filter(([, pct]) => pct > 10).length;

		// --- Spice tolerance ---
		const spiceValues = favSites.map(s => s.heatOverall || 0).filter(v => v > 0);
		const avgSpice = spiceValues.length > 0
			? Math.round((spiceValues.reduce((a, b) => a + b, 0) / spiceValues.length) * 10) / 10
			: 0;

		// --- Salsa preference ---
		const salsaCounts = favSites.map(s => s.salsaCount || 0).filter(v => v > 0);
		const avgSalsaCount = salsaCounts.length > 0
			? Math.round((salsaCounts.reduce((a, b) => a + b, 0) / salsaCounts.length) * 10) / 10
			: 0;

		// --- Type preferences ---
		const typeCounts = { 'Brick and Mortar': 0, Stand: 0, Truck: 0 };
		for (const site of favSites) {
			const t = site.type;
			if (t && t in typeCounts) typeCounts[t]++;
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

		// --- Recommendations ---
		// Score non-favorited spots by similarity to user's taste profile
		const nonFavSites = $processedTacoData.filter(s => !$favoriteIds.has(s.est_id));
		const recommendations = scoreAndRank(nonFavSites, proteinAffinities, avgSpice, avgSalsaCount);

		return {
			favoritesCount: favSites.length,
			proteinAffinities,
			dominantProtein,
			dominantProteinPct,
			proteinDiversity,
			avgSpice,
			avgSalsaCount,
			typePrefs,
			archetype,
			recommendations
		};
	}
);

/**
 * Score sites by similarity to user's taste profile
 */
function scoreAndRank(sites, proteinAffinities, avgSpice, avgSalsaCount) {
	if (sites.length === 0) return [];

	const scored = sites.map(site => {
		let score = 0;

		// Protein similarity (weight: 40%)
		const siteProteins = {};
		const items = site.topFiveProteinItems || [];
		const values = site.topFiveProteinValues || [];
		for (let i = 0; i < items.length; i++) {
			const key = items[i]?.toLowerCase();
			if (key) siteProteins[key] = values[i] || 0;
		}
		const siteTotal = Object.values(siteProteins).reduce((a, b) => a + b, 0);
		if (siteTotal > 0) {
			for (const [protein, userPct] of Object.entries(proteinAffinities)) {
				const sitePct = ((siteProteins[protein] || 0) / siteTotal) * 100;
				// Lower difference = higher score
				score += (100 - Math.abs(userPct - sitePct)) * 0.4 / 100;
			}
		}

		// Spice similarity (weight: 30%)
		const siteSpice = site.heatOverall || 0;
		if (avgSpice > 0) {
			const spiceDiff = Math.abs(siteSpice - avgSpice) / 10; // Normalize to 0-1
			score += (1 - spiceDiff) * 0.3;
		}

		// Salsa similarity (weight: 30%)
		const siteSalsa = site.salsaCount || 0;
		if (avgSalsaCount > 0) {
			const salsaDiff = Math.min(Math.abs(siteSalsa - avgSalsaCount) / 10, 1);
			score += (1 - salsaDiff) * 0.3;
		}

		return { site, score };
	});

	return scored
		.sort((a, b) => b.score - a.score)
		.slice(0, 5)
		.map(s => s.site);
}

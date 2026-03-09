// src/lib/comparisonStore.js
// Manages spot comparison state (select up to 3 sites for side-by-side comparison)

import { writable, derived } from 'svelte/store';

const MAX_COMPARE = 3;

// Stores
export const comparisonSites = writable([]);
export const comparisonActive = writable(false);

// Derived
export const comparisonCount = derived(comparisonSites, $sites => $sites.length);

// Add a site to the comparison (no-op if already present or at max)
export function addToComparison(site) {
	comparisonSites.update(sites => {
		if (sites.length >= MAX_COMPARE) return sites;
		if (sites.some(s => s.est_id === site.est_id)) return sites;
		return [...sites, site];
	});
	comparisonActive.set(true);
}

// Remove a site by est_id
export function removeFromComparison(estId) {
	comparisonSites.update(sites => {
		const updated = sites.filter(s => s.est_id !== estId);
		if (updated.length === 0) comparisonActive.set(false);
		return updated;
	});
}

// Clear all comparison sites
export function clearComparison() {
	comparisonSites.set([]);
	comparisonActive.set(false);
}

// Hide the tray but preserve selected sites
export function closeComparison() {
	comparisonActive.set(false);
}

// Show the tray (if sites exist)
export function openComparison() {
	comparisonActive.set(true);
}

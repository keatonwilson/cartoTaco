/**
 * Theme management with auto mode based on time of day
 * Supports: 'light', 'dark', 'auto'
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Theme preference store ('light', 'dark', or 'auto')
export const themePreference = writable('auto');

// Derived store that calculates the effective theme
export const effectiveTheme = derived(themePreference, ($pref) => {
	return getEffectiveTheme($pref);
});

/**
 * Calculate effective theme based on preference
 * If auto, determines theme based on time of day (6am-8pm = light, otherwise dark)
 */
export function getEffectiveTheme(preference) {
	if (preference === 'auto') {
		const hour = new Date().getHours();
		return hour >= 6 && hour < 20 ? 'light' : 'dark';
	}
	return preference;
}

/**
 * Apply theme to document root
 */
export function applyTheme(theme) {
	if (!browser) return;

	const effective = getEffectiveTheme(theme);
	document.documentElement.classList.toggle('dark', effective === 'dark');
}

/**
 * Initialize theme system with localStorage persistence
 * Call this once on app initialization
 */
export function initTheme() {
	if (!browser) return;

	// Load stored preference
	const stored = localStorage.getItem('theme');
	if (stored && ['light', 'dark', 'auto'].includes(stored)) {
		themePreference.set(stored);
	}

	// Subscribe to preference changes
	themePreference.subscribe((value) => {
		localStorage.setItem('theme', value);
		applyTheme(value);
	});

	// If in auto mode, check hourly for time-based changes
	if (browser) {
		setInterval(() => {
			themePreference.update((pref) => {
				if (pref === 'auto') {
					applyTheme('auto');
				}
				return pref;
			});
		}, 60000); // Check every minute
	}
}

/**
 * Set theme preference
 */
export function setTheme(newTheme) {
	if (['light', 'dark', 'auto'].includes(newTheme)) {
		themePreference.set(newTheme);
	}
}

/**
 * Toggle between light and dark
 * (Skips auto mode for manual toggling)
 */
export function toggleTheme() {
	themePreference.update((current) => {
		const effective = getEffectiveTheme(current);
		return effective === 'light' ? 'dark' : 'light';
	});
}

/**
 * Get Mapbox style URL based on theme
 */
export function getMapboxStyle(theme) {
	const effective = getEffectiveTheme(theme);
	return effective === 'dark'
		? 'mapbox://styles/mapbox/dark-v11'
		: 'mapbox://styles/mapbox/standard';
}

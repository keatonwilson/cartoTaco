/**
 * Trail store - Reactive state management for the Taco Trail Builder feature
 */

import { writable, derived } from 'svelte/store';

// Is trail mode currently active?
export const trailModeActive = writable(false);

// Ordered array of full processedSite objects
export const trailStops = writable([]);

// 'walking' | 'driving'
export const trailTransportMode = writable('walking');

// GeoJSON LineString from Mapbox Directions API, or null
export const trailRoute = writable(null);

// Derived count
export const trailStopCount = derived(trailStops, ($stops) => $stops.length);

/**
 * Enter trail mode
 */
export function enterTrailMode() {
	trailModeActive.set(true);
}

/**
 * Exit trail mode and reset all trail state
 */
export function exitTrailMode() {
	trailModeActive.set(false);
	trailStops.set([]);
	trailRoute.set(null);
	if (typeof window !== 'undefined') {
		history.replaceState({}, '', window.location.pathname);
	}
}

/**
 * Add a stop to the trail (no-op if already present)
 * @param {object} site - Full processedSite object
 */
export function addStop(site) {
	trailStops.update((stops) => {
		if (stops.find((s) => s.est_id === site.est_id)) return stops;
		return [...stops, site];
	});
}

/**
 * Add a "My Location" stop at the start or end of the trail.
 * Replaces any existing location stop (only one allowed at a time).
 * @param {object} site - Location site object with est_id === 'my_location'
 * @param {'start'|'end'} position
 */
export function addLocationStop(site, position) {
	trailStops.update((stops) => {
		const filtered = stops.filter((s) => s.est_id !== 'my_location');
		return position === 'start' ? [site, ...filtered] : [...filtered, site];
	});
}

/**
 * Remove a stop from the trail by est_id
 * @param {number|string} estId
 */
export function removeStop(estId) {
	trailStops.update((stops) => stops.filter((s) => s.est_id !== estId));
}

/**
 * Reorder stops by moving fromIndex to toIndex
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function moveStop(fromIndex, toIndex) {
	trailStops.update((stops) => {
		const newStops = [...stops];
		const [removed] = newStops.splice(fromIndex, 1);
		newStops.splice(toIndex, 0, removed);
		return newStops;
	});
}

/**
 * Clear all stops and the current route
 */
export function clearStops() {
	trailStops.set([]);
	trailRoute.set(null);
}

/**
 * Fetch a route from Mapbox Directions API and update trailRoute
 * @param {object[]} stops - Array of processedSite objects with longitude/latitude
 * @param {string} mode - 'walking' | 'driving'
 */
export async function fetchRoute(stops, mode) {
	if (!stops || stops.length < 2) {
		trailRoute.set(null);
		return;
	}

	const coords = stops.map((s) => `${s.longitude},${s.latitude}`).join(';');
	const profile = mode === 'driving' ? 'driving' : 'walking';
	const token = import.meta.env.VITE_MAPBOX_KEY;
	const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${token}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			trailRoute.set(null);
			return;
		}
		const data = await response.json();
		if (data.routes && data.routes.length > 0) {
			trailRoute.set(data.routes[0].geometry);
		} else {
			trailRoute.set(null);
		}
	} catch (error) {
		console.error('Error fetching trail route:', error);
		trailRoute.set(null);
	}
}

/**
 * Favorites store - Reactive state management for user favorites
 */

import { writable, derived } from 'svelte/store';
import { isAuthenticated } from './authStore';
import { getFavoriteIds, addFavorite as addFav, removeFavorite as removeFav } from './favorites';
import { get } from 'svelte/store';

// Store for favorite establishment IDs
export const favoriteIds = writable(new Set());

// Loading state
export const favoritesLoading = writable(false);

/**
 * Load favorites for the current user
 */
export async function loadFavorites() {
	if (!get(isAuthenticated)) {
		favoriteIds.set(new Set());
		return;
	}

	favoritesLoading.set(true);
	try {
		const ids = await getFavoriteIds();
		favoriteIds.set(ids);
	} catch (error) {
		console.error('Error loading favorites:', error);
	} finally {
		favoritesLoading.set(false);
	}
}

/**
 * Add a favorite and update the store
 * @param {number} estId
 * @returns {Promise<boolean>} Success status
 */
export async function addFavorite(estId) {
	const result = await addFav(estId);
	if (result.success) {
		favoriteIds.update(ids => {
			const newIds = new Set(ids);
			newIds.add(estId);
			return newIds;
		});
	}
	return result.success;
}

/**
 * Remove a favorite and update the store
 * @param {number} estId
 * @returns {Promise<boolean>} Success status
 */
export async function removeFavorite(estId) {
	const result = await removeFav(estId);
	if (result.success) {
		favoriteIds.update(ids => {
			const newIds = new Set(ids);
			newIds.delete(estId);
			return newIds;
		});
	}
	return result.success;
}

/**
 * Toggle favorite status
 * @param {number} estId
 * @returns {Promise<boolean>} New favorite status (true if now favorited)
 */
export async function toggleFavorite(estId) {
	const ids = get(favoriteIds);
	if (ids.has(estId)) {
		await removeFavorite(estId);
		return false;
	} else {
		await addFavorite(estId);
		return true;
	}
}

/**
 * Check if an establishment is favorited
 * @param {number} estId
 * @returns {boolean}
 */
export function isFavorited(estId) {
	return get(favoriteIds).has(estId);
}

// Derived store for favorite count
export const favoritesCount = derived(favoriteIds, $ids => $ids.size);

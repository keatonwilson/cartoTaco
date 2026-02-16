/**
 * Favorites management - CRUD operations for user favorite locations
 */

import { supabaseBrowser, getAuthenticatedUser } from './supabaseBrowser';

/**
 * Add a location to user's favorites
 * @param {number} estId - Establishment ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function addFavorite(estId) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const { error } = await supabaseBrowser
			.from('user_favorites')
			.insert({
				user_id: user.id,
				est_id: estId
			});

		if (error) {
			// Handle duplicate favorite (already exists)
			if (error.code === '23505') {
				return { success: true }; // Already favorited, treat as success
			}
			console.error('Error adding favorite:', error);
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (error) {
		console.error('Exception adding favorite:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Remove a location from user's favorites
 * @param {number} estId - Establishment ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeFavorite(estId) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const { error } = await supabaseBrowser
			.from('user_favorites')
			.delete()
			.eq('user_id', user.id)
			.eq('est_id', estId);

		if (error) {
			console.error('Error removing favorite:', error);
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (error) {
		console.error('Exception removing favorite:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Check if a location is favorited by the current user
 * @param {number} estId - Establishment ID
 * @returns {Promise<boolean>}
 */
export async function isFavorite(estId) {
	try {
		const { user } = await getAuthenticatedUser();
		if (!user) return false;

		const { data, error } = await supabaseBrowser
			.from('user_favorites')
			.select('id')
			.eq('user_id', user.id)
			.eq('est_id', estId)
			.single();

		if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
			console.error('Error checking favorite:', error);
			return false;
		}

		return !!data;
	} catch (error) {
		console.error('Exception checking favorite:', error);
		return false;
	}
}

/**
 * Get all favorites for the current user
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getUserFavorites() {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const { data, error } = await supabaseBrowser
			.from('user_favorites')
			.select('est_id, created_at')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error getting favorites:', error);
			return { success: false, error: error.message };
		}

		return { success: true, data: data || [] };
	} catch (error) {
		console.error('Exception getting favorites:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Get count of favorites for the current user
 * @returns {Promise<number>}
 */
export async function getFavoritesCount() {
	try {
		const { user } = await getAuthenticatedUser();
		if (!user) return 0;

		const { count, error } = await supabaseBrowser
			.from('user_favorites')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', user.id);

		if (error) {
			console.error('Error getting favorites count:', error);
			return 0;
		}

		return count || 0;
	} catch (error) {
		console.error('Exception getting favorites count:', error);
		return 0;
	}
}

/**
 * Get all favorite establishment IDs for the current user as a Set
 * Useful for checking multiple items at once
 * @returns {Promise<Set<number>>}
 */
export async function getFavoriteIds() {
	const result = await getUserFavorites();
	if (!result.success || !result.data) {
		return new Set();
	}
	return new Set(result.data.map(f => f.est_id));
}

/**
 * Vibe votes — anti-review CRUD operations.
 * Users toggle binary emoji votes across four dimensions per spot.
 */

import { supabaseBrowser, getAuthenticatedUser } from './supabaseBrowser';

export const VIBE_DIMENSIONS = ['heat_legit', 'authentic', 'value', 'vibe'];

/**
 * Add a vibe vote for the current user.
 * @param {number} estId
 * @param {string} dimension - one of VIBE_DIMENSIONS
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function addVibeVote(estId, dimension) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const { error } = await supabaseBrowser
			.from('vibe_votes')
			.insert({ user_id: user.id, est_id: estId, dimension });

		if (error) {
			if (error.code === '23505') return { success: true }; // already voted
			console.error('Error adding vibe vote:', error);
			return { success: false, error: error.message };
		}
		return { success: true };
	} catch (error) {
		console.error('Exception adding vibe vote:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Remove a vibe vote for the current user.
 * @param {number} estId
 * @param {string} dimension
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeVibeVote(estId, dimension) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const { error } = await supabaseBrowser
			.from('vibe_votes')
			.delete()
			.eq('user_id', user.id)
			.eq('est_id', estId)
			.eq('dimension', dimension);

		if (error) {
			console.error('Error removing vibe vote:', error);
			return { success: false, error: error.message };
		}
		return { success: true };
	} catch (error) {
		console.error('Exception removing vibe vote:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Get all of the current user's vibe votes as a Set of "estId:dimension" keys.
 * @returns {Promise<Set<string>>}
 */
export async function getUserVibeVoteKeys() {
	try {
		const { user } = await getAuthenticatedUser();
		if (!user) return new Set();

		const { data, error } = await supabaseBrowser
			.from('vibe_votes')
			.select('est_id, dimension')
			.eq('user_id', user.id);

		if (error) {
			console.error('Error fetching user vibe votes:', error);
			return new Set();
		}
		return new Set((data || []).map(v => `${v.est_id}:${v.dimension}`));
	} catch (error) {
		console.error('Exception fetching user vibe votes:', error);
		return new Set();
	}
}

/**
 * Get aggregate vote counts for a single establishment.
 * @param {number} estId
 * @returns {Promise<{heat_legit: number, authentic: number, value: number, vibe: number}>}
 */
export async function getVibeCountsForEst(estId) {
	const empty = { heat_legit: 0, authentic: 0, value: 0, vibe: 0 };
	try {
		const { data, error } = await supabaseBrowser
			.from('vibe_votes')
			.select('dimension')
			.eq('est_id', estId);

		if (error) {
			console.error('Error fetching vibe counts:', error);
			return empty;
		}
		const counts = { ...empty };
		for (const row of data || []) {
			if (row.dimension in counts) counts[row.dimension] += 1;
		}
		return counts;
	} catch (error) {
		console.error('Exception fetching vibe counts:', error);
		return empty;
	}
}

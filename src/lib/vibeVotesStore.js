/**
 * Vibe votes store — reactive state for the anti-review feature.
 * Holds the current user's vote keys and a per-est_id cache of aggregate counts.
 */

import { writable, get } from 'svelte/store';
import { isAuthenticated } from './authStore';
import {
	addVibeVote as addVote,
	removeVibeVote as removeVote,
	getUserVibeVoteKeys,
	getVibeCountsForEst,
	VIBE_DIMENSIONS
} from './vibeVotes';

export { VIBE_DIMENSIONS };

const emptyCounts = () => ({ heat_legit: 0, authentic: 0, value: 0, vibe: 0 });

// "estId:dimension" keys for the current user
export const userVibeVoteKeys = writable(new Set());

// Map<estId, {heat_legit, authentic, value, vibe}>
export const vibeCountsByEst = writable(new Map());

export async function loadUserVibeVotes() {
	if (!get(isAuthenticated)) {
		userVibeVoteKeys.set(new Set());
		return;
	}
	try {
		const keys = await getUserVibeVoteKeys();
		userVibeVoteKeys.set(keys);
	} catch (error) {
		console.error('Error loading user vibe votes:', error);
	}
}

/**
 * Load aggregate counts for a single establishment into the cache.
 * @param {number} estId
 * @param {{ force?: boolean }} [opts]
 */
export async function loadVibeCounts(estId, { force = false } = {}) {
	if (estId == null) return;
	if (!force) {
		const cache = get(vibeCountsByEst);
		if (cache.has(estId)) return;
	}
	const counts = await getVibeCountsForEst(estId);
	vibeCountsByEst.update(map => {
		const next = new Map(map);
		next.set(estId, counts);
		return next;
	});
}

function bumpCount(estId, dimension, delta) {
	vibeCountsByEst.update(map => {
		const next = new Map(map);
		const current = next.get(estId) || emptyCounts();
		next.set(estId, { ...current, [dimension]: Math.max(0, (current[dimension] || 0) + delta) });
		return next;
	});
}

/**
 * Toggle a vote, updating both the user's keys and the local count cache.
 * @param {number} estId
 * @param {string} dimension
 * @returns {Promise<boolean>} true if now voted, false if removed
 */
export async function toggleVibeVote(estId, dimension) {
	const key = `${estId}:${dimension}`;
	const keys = get(userVibeVoteKeys);
	const wasVoted = keys.has(key);

	// Optimistic UI: flip the user state and bump the count immediately.
	userVibeVoteKeys.update(s => {
		const next = new Set(s);
		if (wasVoted) next.delete(key);
		else next.add(key);
		return next;
	});
	bumpCount(estId, dimension, wasVoted ? -1 : 1);

	const result = wasVoted ? await removeVote(estId, dimension) : await addVote(estId, dimension);

	if (!result.success) {
		// Revert on failure.
		userVibeVoteKeys.update(s => {
			const next = new Set(s);
			if (wasVoted) next.add(key);
			else next.delete(key);
			return next;
		});
		bumpCount(estId, dimension, wasVoted ? 1 : -1);
		return wasVoted;
	}
	return !wasVoted;
}

export function hasVoted(estId, dimension) {
	return get(userVibeVoteKeys).has(`${estId}:${dimension}`);
}

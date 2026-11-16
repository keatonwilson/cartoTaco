// src/lib/similarityStore.js
// The description-similarity matrix (site_similarity, migration 042), fetched
// once on first use. A few hundred rows, so the whole thing comes down at once.
// Stays null if the fetch fails or the table doesn't exist yet, and an empty
// Map before cartoTacoMenuExtract has computed anything: either way the
// features that read it simply don't show.

import { writable } from 'svelte/store';
import { supabaseBrowser } from './supabaseBrowser';
import { buildSimilarityIndex } from './similarity';

/** @type {import('svelte/store').Writable<Map<number, Map<number, number>> | null>} */
export const similarityIndex = writable(null);

let pending = null;

export function loadSimilarity() {
	if (pending || !supabaseBrowser) return pending;
	pending = supabaseBrowser
		.from('site_similarity')
		.select('est_id_a, est_id_b, score')
		.then(({ data, error }) => {
			if (error) throw error;
			similarityIndex.set(buildSimilarityIndex(data));
		})
		.catch((error) => {
			console.error('Error loading spot similarity:', error);
			pending = null; // let a later caller retry
		});
	return pending;
}

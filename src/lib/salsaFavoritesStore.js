/**
 * Salsa favorites store - the salsa styles the signed-in user has favourited.
 * Mirrors favoritesStore.js, but holds the whole style (not just an id): the
 * taste profile needs each favourite's flavour scores, including for salsas no
 * spot serves yet, and one joined query gives us those.
 */

import { writable, derived, get } from 'svelte/store';
import { isAuthenticated } from './authStore';
import { supabaseBrowser, getAuthenticatedUser } from './supabaseBrowser';
import { toast } from './toastStore';

const STYLE_COLUMNS = 'id, slug, name, palette, heat_min, heat_max, smoke, acid, sweet, chunk, rich';

// Favourited styles, newest first
export const favoriteSalsas = writable([]);

export const favoriteSalsaSlugs = derived(favoriteSalsas, ($salsas) => new Set($salsas.map((s) => s.slug)));

async function fetchFavorites() {
	const { user, error: authError } = await getAuthenticatedUser();
	if (authError) return [];
	const { data, error } = await supabaseBrowser
		.from('user_favorite_salsas')
		.select(`created_at, salsa_styles(${STYLE_COLUMNS})`)
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data.map((row) => row.salsa_styles).filter(Boolean);
}

async function writeFavorite(style, favourited) {
	const { user, error: authError } = await getAuthenticatedUser();
	if (authError) throw new Error(authError);
	const table = supabaseBrowser.from('user_favorite_salsas');
	const { error } = favourited
		? await table.upsert({ user_id: user.id, style_id: style.id }, { ignoreDuplicates: true })
		: await table.delete().eq('user_id', user.id).eq('style_id', style.id);
	if (error) throw error;
}

export async function loadSalsaFavorites() {
	if (!get(isAuthenticated)) {
		favoriteSalsas.set([]);
		return;
	}
	try {
		favoriteSalsas.set(await fetchFavorites());
	} catch (error) {
		console.error('Error loading salsa favorites:', error);
	}
}

/**
 * Favourite or unfavourite a style. Optimistic: the store flips first and is
 * put back if the write fails.
 * @param {object} style - a salsa_styles row (needs id and slug)
 * @returns {Promise<boolean>} whether it is now favourited
 */
export async function toggleSalsaFavorite(style) {
	const before = get(favoriteSalsas);
	const favourited = !before.some((s) => s.slug === style.slug);
	favoriteSalsas.set(favourited ? [style, ...before] : before.filter((s) => s.slug !== style.slug));
	try {
		await writeFavorite(style, favourited);
		return favourited;
	} catch (error) {
		console.error('Error saving salsa favorite:', error);
		favoriteSalsas.set(before);
		toast.error("Couldn't save that just now. Try again in a moment.");
		return !favourited;
	}
}

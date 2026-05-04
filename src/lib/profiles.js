/**
 * Profiles — read/update profile rows and upload avatars.
 *
 * Public reads use only safe columns (id, username, display_name, avatar_url,
 * bio, created_at). Email is never selected on public surfaces.
 */

import { supabaseBrowser, getAuthenticatedUser } from './supabaseBrowser';

const PUBLIC_COLUMNS = 'id, username, display_name, avatar_url, bio, created_at';

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const BIO_MAX = 280;
export const DISPLAY_NAME_MAX = 50;

/**
 * Validate a candidate username. Returns null if valid, otherwise an error message.
 */
export function validateUsername(value) {
	if (!value) return 'Username is required';
	if (value.length < 3) return 'Must be at least 3 characters';
	if (value.length > 20) return 'Must be 20 characters or fewer';
	if (!USERNAME_REGEX.test(value)) return 'Use lowercase letters, numbers, and underscores only';
	return null;
}

/**
 * Fetch the current authenticated user's profile (full row, including email).
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getOwnProfile() {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const { data, error } = await supabaseBrowser
			.from('profiles')
			.select('id, email, username, display_name, avatar_url, bio, created_at, updated_at')
			.eq('id', user.id)
			.maybeSingle();

		if (error) return { success: false, error: error.message };
		return { success: true, data };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Look up a public profile by username (case-insensitive).
 * @param {string} username
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function getProfileByUsername(username) {
	if (!username) return { success: false, error: 'Username required' };
	try {
		const { data, error } = await supabaseBrowser
			.from('profiles')
			.select(PUBLIC_COLUMNS)
			.eq('username', username.toLowerCase())
			.maybeSingle();

		if (error) return { success: false, error: error.message };
		if (!data) return { success: false, error: 'not_found' };
		return { success: true, data };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Patch the current user's profile. Pass only fields you want to change.
 * @param {{ display_name?: string|null, username?: string|null, bio?: string|null, avatar_url?: string|null }} updates
 */
export async function updateProfile(updates) {
	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const payload = {};
		if ('display_name' in updates) payload.display_name = normalizeText(updates.display_name);
		if ('username' in updates) payload.username = updates.username?.toLowerCase().trim() || null;
		if ('bio' in updates) payload.bio = normalizeText(updates.bio);
		if ('avatar_url' in updates) payload.avatar_url = updates.avatar_url || null;

		const { data, error } = await supabaseBrowser
			.from('profiles')
			.update(payload)
			.eq('id', user.id)
			.select('id, email, username, display_name, avatar_url, bio, created_at, updated_at')
			.single();

		if (error) {
			// Unique constraint on username
			if (error.code === '23505') return { success: false, error: 'That username is taken' };
			// Check constraint (regex/length)
			if (error.code === '23514') return { success: false, error: 'Invalid username or bio format' };
			return { success: false, error: error.message };
		}
		return { success: true, data };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Upload an avatar image to storage and return its public URL.
 * Replaces any existing file at the user's path.
 * @param {File} file
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadAvatar(file) {
	if (!file) return { success: false, error: 'No file selected' };
	if (file.size > 1_048_576) return { success: false, error: 'Image must be under 1 MB' };
	if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
		return { success: false, error: 'Use a JPEG, PNG, or WebP image' };
	}

	try {
		const { user, error: authError } = await getAuthenticatedUser();
		if (authError) return { success: false, error: authError };

		const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
		const path = `${user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabaseBrowser
			.storage
			.from('avatars')
			.upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

		if (uploadError) return { success: false, error: uploadError.message };

		const { data: pub } = supabaseBrowser.storage.from('avatars').getPublicUrl(path);
		// Bust caches when the file at the same path is replaced.
		const url = `${pub.publicUrl}?t=${Date.now()}`;

		const updateResult = await updateProfile({ avatar_url: url });
		if (!updateResult.success) return { success: false, error: updateResult.error };

		return { success: true, url };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

function normalizeText(value) {
	if (value == null) return null;
	const trimmed = String(value).trim();
	return trimmed.length === 0 ? null : trimmed;
}

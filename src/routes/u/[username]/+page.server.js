import { error } from '@sveltejs/kit';

const PUBLIC_COLUMNS = 'id, username, display_name, avatar_url, bio, created_at';
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export async function load({ params, locals }) {
	const username = (params.username || '').toLowerCase();
	if (!USERNAME_REGEX.test(username)) {
		throw error(404, 'Profile not found');
	}

	if (!locals.supabase) {
		throw error(503, 'Profile lookup is unavailable right now');
	}

	const { data, error: dbError } = await locals.supabase
		.from('profiles')
		.select(PUBLIC_COLUMNS)
		.eq('username', username)
		.maybeSingle();

	if (dbError) {
		throw error(500, dbError.message);
	}
	if (!data) {
		throw error(404, 'Profile not found');
	}

	return { profile: data };
}

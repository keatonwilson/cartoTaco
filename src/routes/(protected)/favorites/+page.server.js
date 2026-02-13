import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	// Check if user is authenticated
	if (!locals.session) {
		throw redirect(303, '/login?redirect=/favorites');
	}

	// Return user data from the session
	return {
		user: locals.session.user
	};
}

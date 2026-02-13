import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	// Check if user is authenticated
	const session = await locals.supabase.auth.getSession();

	if (!session?.data?.session) {
		// Redirect to login if not authenticated
		throw redirect(303, '/login?redirectTo=/submit');
	}

	// Return user data for the page
	return {
		user: session.data.session.user
	};
}

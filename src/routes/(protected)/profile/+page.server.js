// src/routes/(protected)/profile/+page.server.js
// Server-side load function for the profile page

import { redirect } from '@sveltejs/kit';

/**
 * Server-side load function that runs before the page loads
 * Ensures user is authenticated before allowing access
 */
export async function load({ locals }) {
  // Check if user is authenticated
  if (!locals.session) {
    // Redirect to login if not authenticated
    throw redirect(303, '/login');
  }

  // Return user data from the session
  return {
    user: locals.session.user
  };
}

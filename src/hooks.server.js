// src/hooks.server.js
// Server-side middleware for authentication and route protection

import { createSupabaseServerClient, getSession } from '$lib/auth';
import { redirect } from '@sveltejs/kit';

/**
 * Server hook that runs on every request
 * - Creates Supabase client with cookie handling
 * - Stores session in event.locals for all routes
 * - Handles route protection logic
 */
export async function handle({ event, resolve }) {
  // Create Supabase client for this request
  event.locals.supabase = createSupabaseServerClient(event);

  // Get session and store in event.locals
  event.locals.session = await getSession(event);

  // Route protection logic
  const url = event.url.pathname;
  const session = event.locals.session;

  // Redirect authenticated users away from auth pages
  if (session && (url === '/login' || url === '/signup')) {
    throw redirect(303, '/');
  }

  // Redirect unauthenticated users away from protected pages
  if (!session && url.startsWith('/profile')) {
    throw redirect(303, '/login');
  }

  return resolve(event);
}

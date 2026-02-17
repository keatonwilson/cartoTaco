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
  const url = event.url.pathname;

  // Try to set up Supabase auth; if credentials are missing the app
  // should still render public pages (map, login, signup).
  try {
    event.locals.supabase = createSupabaseServerClient(event);
    event.locals.session = await getSession(event);
  } catch {
    event.locals.supabase = null;
    event.locals.session = null;
  }

  const session = event.locals.session;

  // Redirect authenticated users away from auth pages
  if (session && (url === '/login' || url === '/signup')) {
    throw redirect(303, '/');
  }

  // Redirect unauthenticated users away from protected pages
  if (!session && (url.startsWith('/profile') || url.startsWith('/submit') || url.startsWith('/favorites'))) {
    throw redirect(303, '/login');
  }

  return resolve(event);
}

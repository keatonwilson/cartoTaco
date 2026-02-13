// src/lib/auth.js
// Server-side Supabase client with cookie handling for SvelteKit

import { createServerClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for server-side operations with cookie handling
 * @param {Object} event - SvelteKit event object with cookies
 * @returns {Object} Supabase client instance
 */
export function createSupabaseServerClient(event) {
  return createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' });
          });
        },
      },
    }
  );
}

/**
 * Gets the current user session from the server
 * @param {Object} event - SvelteKit event object
 * @returns {Promise<Object|null>} Session object or null
 */
export async function getSession(event) {
  const supabase = createSupabaseServerClient(event);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Gets the current user from the server
 * @param {Object} event - SvelteKit event object
 * @returns {Promise<Object|null>} User object or null
 */
export async function getUser(event) {
  const supabase = createSupabaseServerClient(event);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

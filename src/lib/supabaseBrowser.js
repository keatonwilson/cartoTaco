// src/lib/supabaseBrowser.js
// Browser-side Supabase client with cookie support for SSR

import { createBrowserClient } from '@supabase/ssr';
import { browser } from '$app/environment';

export const supabaseBrowser = browser
  ? createBrowserClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
  : null;

/**
 * Get the current authenticated user, or return an error result.
 * Consolidates the repeated auth-check pattern used across favorites.js and submissions.js.
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function getAuthenticatedUser() {
  if (!supabaseBrowser) {
    return { user: null, error: 'Supabase client not available' };
  }
  const { data: { user }, error } = await supabaseBrowser.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Not authenticated' };
  }
  return { user, error: null };
}

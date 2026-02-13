// src/lib/authStore.js
// Client-side authentication store following the createDataStore pattern

import { writable, derived } from 'svelte/store';
import { supabaseBrowser } from './supabaseBrowser';
import { browser } from '$app/environment';

/**
 * Create auth store with user, session, loading, and error state
 */
function createAuthStore() {
  const { subscribe, set, update } = writable({
    user: null,
    session: null,
    loading: true,
    error: null
  });

  return {
    subscribe,
    set,
    update,
    setUser: (user) => update(store => ({ ...store, user, loading: false })),
    setSession: (session) => update(store => ({ ...store, session, loading: false })),
    setAuth: (user, session) => update(store => ({ ...store, user, session, loading: false })),
    setLoading: (loading) => update(store => ({ ...store, loading })),
    setError: (error) => update(store => ({ ...store, error, loading: false })),
    clearAuth: () => set({ user: null, session: null, loading: false, error: null })
  };
}

// Main auth store
export const authStore = createAuthStore();

// Derived stores for convenience
export const isAuthenticated = derived(authStore, $store => !!$store.user);
export const currentUser = derived(authStore, $store => $store.user);
export const currentSession = derived(authStore, $store => $store.session);

/**
 * Sign up a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {Object} metadata - Optional user metadata (e.g., display_name)
 * @returns {Promise<Object>} - { user, session, error }
 */
export async function signUp(email, password, metadata = {}) {
  if (!browser) return { user: null, session: null, error: 'Not in browser' };

  authStore.setLoading(true);

  try {
    const { data, error } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) {
      authStore.setError(error.message);
      return { user: null, session: null, error };
    }

    authStore.setAuth(data.user, data.session);
    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    authStore.setError(error.message);
    return { user: null, session: null, error };
  }
}

/**
 * Sign in an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} - { user, session, error }
 */
export async function signIn(email, password) {
  if (!browser) return { user: null, session: null, error: 'Not in browser' };

  authStore.setLoading(true);

  try {
    const { data, error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      authStore.setError(error.message);
      return { user: null, session: null, error };
    }

    authStore.setAuth(data.user, data.session);
    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    authStore.setError(error.message);
    return { user: null, session: null, error };
  }
}

/**
 * Sign out the current user
 * @returns {Promise<Object>} - { error }
 */
export async function signOut() {
  if (!browser) return { error: 'Not in browser' };

  authStore.setLoading(true);

  try {
    const { error } = await supabaseBrowser.auth.signOut();

    if (error) {
      authStore.setError(error.message);
      return { error };
    }

    authStore.clearAuth();
    return { error: null };
  } catch (error) {
    authStore.setError(error.message);
    return { error };
  }
}

/**
 * Initialize auth state from current session
 * Auto-called on module load (like fetchSiteData)
 */
async function initializeAuth() {
  if (!browser) return;

  authStore.setLoading(true);

  try {
    // Get current session
    const { data: { session }, error } = await supabaseBrowser.auth.getSession();

    if (error) {
      console.error('Error getting session:', error);
      // Clear auth on error to ensure loading is set to false
      authStore.clearAuth();
      authStore.update(store => ({ ...store, error: error.message }));
      return;
    }

    if (session) {
      authStore.setAuth(session.user, session);
    } else {
      authStore.clearAuth();
    }

    // Subscribe to auth state changes for real-time updates
    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          authStore.setAuth(session.user, session);
        } else {
          authStore.clearAuth();
        }
      }
    );

    // Store unsubscribe function (optional - for cleanup if needed)
    if (authListener && authListener.subscription) {
      // Could expose this for manual cleanup if needed
    }
  } catch (error) {
    console.error('Error initializing auth:', error);
    // Clear auth on error to ensure loading is set to false
    authStore.clearAuth();
    authStore.update(store => ({ ...store, error: error.message }));
  }
}

// Auto-initialize on module load (browser only)
if (browser) {
  initializeAuth();
}

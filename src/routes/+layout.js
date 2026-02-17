// Disable prerendering for the entire app — all routes depend on
// Supabase via hooks.server.js, so they must be server-rendered.
export const prerender = false;

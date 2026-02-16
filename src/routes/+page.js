// Disable prerendering — the app fetches from Supabase at runtime
// via hooks.server.js, so the index route cannot be statically rendered.
export const prerender = false;

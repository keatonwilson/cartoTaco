// src/lib/server/catalog.js
// The concierge's view of the map: sites_complete through processSites(), the
// same rows the browser loads. Public data, so one copy serves every user.
import { processSites } from '$lib/siteModel.js';

const TTL = 5 * 60 * 1000;
let cached = null; // { at, sites }

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function getCatalog(supabase) {
  if (cached && Date.now() - cached.at < TTL) return cached.sites;
  const { data, error } = await supabase.from('sites_complete').select('*').order('est_id');
  if (error) throw error;
  cached = { at: Date.now(), sites: processSites(data) };
  return cached.sites;
}

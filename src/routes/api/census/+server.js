// The Tucson Taco Census as public JSON, plus what's open right now, for
// other sites to draw (prosopis.studio builds its CartoTaco charts from it).
//
// Public by design, so it is kept apart from anything per-user:
// - an anonymous client with no session, never the caller's cookie client, so
//   the answer can't depend on who asks (hooks.server.js skips auth here too,
//   so no Set-Cookie ever rides on a shared, edge-cached response);
// - names, open labels and aggregates only: no ids, coordinates, addresses,
//   pending or closed spots, or per-spot history;
// - CORS open for GET without credentials, and errors say nothing about why.
import { error, json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { getCatalog } from '$lib/server/catalog.js';
import { computeCensus, hasValidCoordinates } from '$lib/siteModel.js';
import { getOpenStatus } from '$lib/hours.js';

const HEADERS = {
  'access-control-allow-origin': '*',
  'x-content-type-options': 'nosniff',
  // "Open now" goes stale by the minute, so keep the edge copy short
  'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
};

let anon = null;
function anonClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (anon ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

/** The census minus the per-spot growth events, and the spots open at `now`. */
export function _publicCensus(sites, now = new Date()) {
  const census = computeCensus(sites, now);
  if (!census) return null;
  const { growth, newest, ...rest } = census;
  const openSpots = sites
    .filter((s) => !s.isPending && !s.isClosed && hasValidCoordinates(s))
    .map((s) => ({ name: s.name, ...getOpenStatus(s.rawData?.hours, now) }))
    .filter((s) => s.isOpen)
    .map(({ name, state, label }) => ({ name, state, label }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    generatedAt: now.toISOString(),
    ...rest,
    newest: newest && { name: newest.name, createdAt: newest.createdAt },
    spotsOverTime: growth.map(({ date, count }) => ({ date, count })),
    openSpots
  };
}

export async function GET() {
  const db = anonClient();
  let body = null;
  if (db) {
    try {
      body = _publicCensus(await getCatalog(db));
    } catch (e) {
      console.error('census unavailable', e?.message);
    }
  }
  if (!body) throw error(503, 'The census is unavailable right now');
  return json(body, { headers: HEADERS });
}

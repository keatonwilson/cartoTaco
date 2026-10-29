// src/lib/server/kb.js
// The published knowledgebase (cocina, a separate Supabase project), read
// whole: a few hundred cards, cached like the catalog, so describe_dish needs
// no round trip. Consumers only ever see published rows (cocina's RLS).
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

const TTL = 5 * 60 * 1000;
const EMPTY = { version: null, cards: [] };
let cached = null; // { at, kb }

export async function getKb() {
  if (cached && Date.now() - cached.at < TTL) return cached.kb;
  if (!env.KB_URL || !env.KB_ANON_KEY) return EMPTY;
  const db = createClient(env.KB_URL, env.KB_ANON_KEY, { auth: { persistSession: false } });
  const [cards, version] = await Promise.all([db.rpc('cards'), db.rpc('kb_version')]);
  const err = cards.error || version.error;
  if (err) {
    // ponytail: a knowledgebase outage costs dish answers, not the whole chat;
    // keep serving the last good copy and try again after the TTL
    console.error('knowledgebase unavailable', err.message);
    if (!cached) return EMPTY;
    cached.at = Date.now();
    return cached.kb;
  }
  cached = { at: Date.now(), kb: { version: version.data, cards: cards.data } };
  return cached.kb;
}

// Sourced descriptions for spot cards: cocina's published writeups, by slug,
// plus a name → slug index. Published knowledge only, so cacheable at the edge.
import { json } from '@sveltejs/kit';
import { getKb } from '$lib/server/kb.js';
import { writeupIndex } from '$lib/kb.js';

export async function GET() {
  const kb = await getKb();
  return json({ version: kb.version, ...writeupIndex(kb.cards) }, {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=300' }
  });
}

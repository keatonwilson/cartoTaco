// Freeze sites_complete into evals/fixtures/sites_snapshot.json so evals and
// harness tests run against fixed data. Reads with the anon key, like the app.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… node evals/refresh-fixture.js
//
// Falls back to VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (local .env is
// prod). Golden examples name est_ids, so re-check them after a refresh.
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY');

const res = await fetch(`${url}/rest/v1/sites_complete?select=*&order=est_id`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }
});
if (!res.ok) throw new Error(`sites_complete: ${res.status} ${await res.text()}`);
const rows = await res.json();

const out = new URL('./fixtures/sites_snapshot.json', import.meta.url);
writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
console.log(`Wrote ${rows.length} spots to ${out.pathname}`);

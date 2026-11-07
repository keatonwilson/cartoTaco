import { describe, it, expect, vi } from 'vitest';
import { processSites } from '$lib/siteModel.js';
import { _publicCensus as publicCensus } from './+server.js';

// sites_complete rows: Spot 1 open 11–9 every day, Spot 2 closed for good,
// Spot 3 open 7 AM–2 PM.
const hours = (start, end) =>
  Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].flatMap((d) => [[`${d}_start`, start], [`${d}_end`, end]]));
const row = (id, h, closedAt = null) => ({
  est_id: id,
  site: { est_id: id, name: `Spot ${id}`, type: 'Truck', lat_1: 32.2, lon_1: -110.9, created_at: '2026-01-0' + id + 'T00:00:00Z', vetting_status: 'vetted', source: 'editorial', closed_at: closedAt },
  descriptions: { short_descrip: '', long_descrip: '', region: 'Sonora' },
  menu: { taco_yes: true, taco_perc: 1 },
  hours: h,
  salsa: { total_num: 3, heat_overall: 6 },
  protein: { beef_yes: true, beef_perc: 1 }
});
const sites = processSites([row(1, hours('11:00 AM', '9:00 PM')), row(2, hours('11:00 AM', '9:00 PM'), '2026-03-01T00:00:00Z'), row(3, hours('7:00 AM', '2:00 PM'))]);

describe('publicCensus', () => {
  it('lists the spots open at that moment on Tucson time, never closed ones', () => {
    // 19:00 UTC is noon in Tucson (UTC−7, no DST)
    const body = publicCensus(sites, new Date('2026-11-07T19:00:00Z'));
    expect(body.openSpots.map((s) => s.name)).toEqual(['Spot 1', 'Spot 3']);
    expect(body.openNow).toBe(2);
    expect(body.openSpots[0].label).toBe('Open til 9 PM');
  });

  it('keeps the aggregates and drops per-spot history', () => {
    const body = publicCensus(sites, new Date('2026-11-08T04:00:00Z')); // 9 PM: all closed
    expect(body.openSpots).toEqual([]);
    expect(body.totalSpots).toBe(2);
    expect(body.heatHistogram[6].count).toBe(2);
    expect(body.growth).toBeUndefined();
    expect(body.spotsOverTime.at(-1)).toEqual({ date: '2026-03-01T00:00:00Z', count: 2 });
    expect(Object.keys(body.spotsOverTime[0])).toEqual(['date', 'count']);
  });
});

describe('GET /api/census', () => {
  it('answers with open CORS, a short public cache and no cookies', async () => {
    vi.resetModules();
    vi.doMock('$lib/server/catalog.js', () => ({ getCatalog: async () => sites }));
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
    vi.stubEnv('VITE_SUPABASE_URL', 'http://db');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { GET } = await import('./+server.js');
    const res = await GET();
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toMatch(/^public/);
    expect(res.headers.get('set-cookie')).toBeNull();
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/est_id|latitude|longitude|address|"id"/);
  });

  it('hides why the database failed', async () => {
    vi.resetModules();
    vi.doMock('$lib/server/catalog.js', () => ({ getCatalog: async () => { throw new Error('password authentication failed for db.internal'); } }));
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
    vi.stubEnv('VITE_SUPABASE_URL', 'http://db');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const { GET } = await import('./+server.js');
    const err = await GET().catch((e) => e);
    expect(err.status).toBe(503);
    expect(JSON.stringify(err.body)).not.toMatch(/password|internal/);
  });
});

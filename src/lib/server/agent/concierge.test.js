import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AIMessage } from '@langchain/core/messages';
import { processSites } from '../../siteModel.js';
import { runConcierge, cleanReply } from './concierge.js';
import { makeTools } from './tools.js';

const catalog = processSites(JSON.parse(
  readFileSync(new URL('../../../../evals/fixtures/sites_snapshot.json', import.meta.url))
));
// A Friday at 7 PM in Tucson
const now = new Date('2026-10-24T02:00:00Z');

const usage = { input_tokens: 100, output_tokens: 20 };

// A router that returns a fixed route
const fakeRouter = (route) => ({
  withStructuredOutput: () => ({
    invoke: async () => ({ raw: { usage_metadata: usage }, parsed: { confidence: 0.9, needs_agent: false, language: 'en', ...route } })
  })
});

// A chat model that replays scripted turns
const fakeModel = (...turns) => ({
  bindTools() { return this; },
  invoke: async () => {
    const t = turns.shift();
    if (!t) throw new Error('fake model ran out of turns');
    return new AIMessage({ content: t.text ?? '', tool_calls: t.calls ?? [], usage_metadata: usage });
  }
});
const call = (name, args) => ({ name, args, id: `call_${Math.random()}`, type: 'tool_call' });

const run = (query, llm = {}, extra = {}) =>
  runConcierge({ query, catalog, now, llm, ...extra });

describe('T0, no model', () => {
  it('applies filters for a fully covered query', async () => {
    const r = await run('spicy pork open now, no trucks');
    expect(r.tier).toBe('t0');
    expect(r.calls).toHaveLength(0);
    expect(r.actions[0]).toMatchObject({
      type: 'apply_filters',
      filters: { proteins: { pork: true }, openNow: true, spiceLevel: { min: 7, max: 10 } }
    });
    expect(r.actions[0].filters.types.Truck).toBe(false);
  });

  it('shows a spot from its name, typos and all', async () => {
    const r = await run('tacos apsn');
    expect(r.tier).toBe('t0');
    expect(r.actions).toEqual([{ type: 'show_spot', est_id: 4 }]);
  });

  it('flags a closed spot', async () => {
    const r = await run('hot dogs 501');
    expect(r.actions).toEqual([{ type: 'show_spot', est_id: 23 }]);
    expect(r.reply).toMatch(/permanently closed/);
  });

  it('answers from rules only when over budget', async () => {
    expect((await run('fish stands', {}, { rulesOnly: true })).tier).toBe('t0');
    const r = await run('what salsas does apson have?', {}, { rulesOnly: true });
    expect(r).toMatchObject({ tier: 't0', calls: [], actions: [], escalation_reason: 'budget' });
    const down = await run('what salsas does apson have?', {}, { rulesOnly: 'unavailable' });
    expect(down.reply).toMatch(/isn’t available right now/);
  });

  it('leaves favorites to the router when signed out', async () => {
    const r = await run('my favorites', { router: fakeRouter({ intent: 'chitchat' }) });
    expect(r.tier).toBe('t1');
  });
});

describe('T1, router + handler', () => {
  it('answers chitchat without an agent', async () => {
    const r = await run('hola!', { router: fakeRouter({ intent: 'chitchat', language: 'es' }) });
    expect(r).toMatchObject({ tier: 't1', actions: [] });
    expect(r.reply).toMatch(/Puedo/);
    expect(r.calls).toHaveLength(1);
  });

  it('resolves find_spot from the slot', async () => {
    const r = await run('take me to that birria truck chivo', {
      router: fakeRouter({ intent: 'find_spot', spot_name: 'El Chivo de Oro' })
    });
    expect(r.tier).toBe('t1');
    expect(r.actions).toEqual([{ type: 'show_spot', est_id: 2 }]);
  });

  it('applies router filters', async () => {
    const r = await run('somewhere with fish that is a stand', {
      router: fakeRouter({ intent: 'filter', filters: { proteins: ['fish'], types: ['Stand'] } })
    });
    expect(r.tier).toBe('t1');
    expect(r.actions[0].filters.types).toEqual({ 'Brick and Mortar': false, Stand: true, Truck: false });
  });
});

describe('T2/T3, agent loop', () => {
  const route = { intent: 'spot_fact', spot_name: 'Tacos Apson', needs_agent: true };

  it('runs tools and returns a grounded reply', async () => {
    const r = await run('what salsas does apson have and is it open', {
      router: fakeRouter(route),
      agent: fakeModel(
        { calls: [call('search_spots', { query: 'Apson' })] },
        { calls: [call('get_spot', { est_id: 4 }), call('show_spot', { est_id: 4 })] },
        { text: 'Tacos Apson [#4] has five salsas.' }
      )
    });
    expect(r.tier).toBe('t2');
    expect(r.actions).toEqual([{ type: 'show_spot', est_id: 4 }]);
    expect(r.calls).toHaveLength(4);
  });

  it('rejects an unknown est_id and lets the model recover', async () => {
    const r = await run('show me spot 999', {
      router: fakeRouter(route),
      agent: fakeModel(
        { calls: [call('show_spot', { est_id: 999 })] },
        { text: 'I couldn’t find that spot.' }
      )
    });
    expect(r.tier).toBe('t2');
    expect(r.actions).toEqual([]);
  });

  it('escalates when T2 cites a spot no tool returned', async () => {
    const r = await run('best birria?', {
      router: fakeRouter({ intent: 'recommend', needs_agent: true }),
      agent: fakeModel({ text: 'Try Karamelo King [#8].' }),
      escalation: fakeModel(
        { calls: [call('search_spots', { query: 'birria' })] },
        { text: 'El Chivo de Oro [#2] is known for birria.' }
      )
    });
    expect(r.tier).toBe('t3');
    expect(r.escalation_reason).toBe('cited_unseen:8');
  });

  it('escalates on the step cap, and drops T2 actions', async () => {
    const loop = Array.from({ length: 4 }, () => ({ calls: [call('show_spot', { est_id: 4 })] }));
    const r = await run('apson apson', {
      router: fakeRouter(route),
      agent: fakeModel(...loop),
      escalation: fakeModel({ text: 'Here you go.' })
    });
    expect(r).toMatchObject({ tier: 't3', escalation_reason: 'step_cap', actions: [] });
  });
});

describe('tools', () => {
  const { fns } = makeTools({ catalog, now });

  it('search_spots filters and searches together', () => {
    const r = fns.search_spots({ query: 'birria', types: ['Truck'] });
    expect(r.spots.length).toBeGreaterThan(0);
    expect(r.spots.every((s) => s.type === 'Truck')).toBe(true);
  });

  it('get_spot marks pending spots and skips their measurements', () => {
    const r = fns.get_spot({ est_id: 27 });
    expect(r.pending).toBe(true);
    expect(r.salsa_lineup).toBeUndefined();
  });

  it('favorites need a signed-in user', () => {
    expect(() => fns.apply_filters({ favorites_only: true })).toThrow(/not signed in/);
  });
});

describe('search_spots sorting', () => {
  it('lists the hottest spots first without a query', () => {
    const { fns } = makeTools({ catalog, now });
    const r = fns.search_spots({ sort_by: 'heat', limit: 3 });
    expect(r).not.toHaveProperty('total');
    expect(fns.search_spots({ sort_by: 'heat', types: ['Truck'] })).toHaveProperty('total');
    expect(fns.search_spots({ query: 'birria', near_est_id: 4 })).not.toHaveProperty('total');
    const heats = r.spots.map((s) => s.heat);
    expect(heats[0]).toBe(8);
    expect(heats).toEqual([...heats].sort((a, b) => b - a));
  });
});

describe('phase 4 tools', () => {
  const fan = { favoriteIds: new Set([4, 8, 38]) };

  it('a trail request runs the agent with plan_trail', async () => {
    const r = await run('plan a bike crawl', {
      router: fakeRouter({ intent: 'trail', needs_agent: true }),
      agent: fakeModel(
        { calls: [call('plan_trail', { est_ids: [4, 8, 2], mode: 'cycling' })] },
        { text: 'Tacos Apson [#4], then El Chivo de Oro [#2], then Karamelo King [#8].' }
      )
    });
    expect(r.tier).toBe('t2');
    expect(r.actions).toEqual([{ type: 'plan_trail', est_ids: [4, 2, 8], mode: 'cycling' }]);
  });

  it('has room to re-plan a trail plan_trail warned was long', async () => {
    const r = await run('a birria trail I can walk', {
      router: fakeRouter({ intent: 'trail', needs_agent: true }),
      agent: fakeModel(
        { calls: [call('search_spots', { query: 'birria' })] },
        { calls: [call('plan_trail', { est_ids: [4, 8, 2, 14] })] },
        { calls: [call('search_spots', { query: 'birria', near_est_id: 4 })] },
        { calls: [call('plan_trail', { est_ids: [4, 10] })] },
        { text: 'Tacos Apson [#4], then Carnitas La Yoca [#10].' }
      )
    });
    expect(r).toMatchObject({ tier: 't2', escalation_reason: null });
    expect(r.actions).toEqual([{ type: 'plan_trail', est_ids: [4, 10], mode: 'walking' }]);
  });

  it('plan_trail orders stops nearest-first and refuses closed spots', () => {
    const { fns } = makeTools({ catalog, now });
    const { stops, straight_line_km } = fns.plan_trail({ est_ids: [4, 8, 2, 14] });
    expect(stops.map((s) => s.est_id)).toEqual([4, 2, 8, 14]);
    expect(straight_line_km).toBeGreaterThan(0);
    expect(fns.plan_trail({ est_ids: [4, 8, 2, 14] }).warning).toMatch(/long for walking/);
    expect(fns.plan_trail({ est_ids: [4, 10] }).warning).toBeUndefined();
    expect(() => fns.plan_trail({ est_ids: [4, 23] })).toThrow(/permanently closed/);
    expect(() => fns.plan_trail({ est_ids: [4, 4] })).toThrow(/2 to 8/);
  });

  it('search_spots near a spot sorts by distance', () => {
    const { fns } = makeTools({ catalog, now });
    const { spots } = fns.search_spots({ near_est_id: 4, limit: 4 });
    expect(spots.map((s) => s.est_id)).not.toContain(4);
    const kms = spots.map((s) => s.km_away);
    expect(kms).toEqual([...kms].sort((a, b) => a - b));
  });

  it('compare_spots and start_summit record their actions within limits', () => {
    const { fns, actions } = makeTools({ catalog, now });
    expect(fns.compare_spots({ est_ids: [4, 8] }).spots).toHaveLength(2);
    expect(() => fns.compare_spots({ est_ids: [4, 8, 2, 14] })).toThrow(/2 to 3/);
    fns.start_summit({ est_ids: [4, 8, 2], title: '  Friday tacos ' });
    expect(actions).toEqual([
      { type: 'compare', est_ids: [4, 8] },
      { type: 'start_summit', est_ids: [4, 8, 2], title: 'Friday tacos' }
    ]);
  });

  it('recommend_for_me needs a signed-in user with favorites', () => {
    expect(() => makeTools({ catalog, now }).fns.recommend_for_me({})).toThrow(/not signed in/);
    expect(() => makeTools({ catalog, now, user: { favoriteIds: new Set() } }).fns.recommend_for_me({})).toThrow(/no favorite/);
    const { picks } = makeTools({ catalog, now, user: fan }).fns.recommend_for_me({ limit: 3 });
    expect(picks).toHaveLength(3);
    expect(picks.some((p) => fan.favoriteIds.has(p.est_id) || p.closed || p.pending)).toBe(false);
  });
});

describe('agent replies', () => {
  it('keeps text written before the last tool call', async () => {
    const r = await run('is apson open', {
      router: fakeRouter({ intent: 'spot_fact', needs_agent: true }),
      agent: fakeModel(
        { calls: [call('get_spot', { est_id: 4 })] },
        { text: 'Tacos Apson [#4] is open until midnight.', calls: [call('show_spot', { est_id: 4 })] },
        { text: 'I’ve opened its card.' }
      )
    });
    expect(r.reply).toBe('Tacos Apson [#4] is open until midnight.\n\nI’ve opened its card.');
  });

  it('drops narration written alongside a lookup', async () => {
    const r = await run('what salsas does karamelo king have', {
      router: fakeRouter({ intent: 'spot_fact', needs_agent: true }),
      agent: fakeModel(
        { text: 'I’ll look up the salsa lineup.', calls: [call('search_spots', { query: 'Karamelo King' })] },
        { text: 'Now let me get the details:', calls: [call('get_spot', { est_id: 8 })] },
        { text: 'Karamelo King [#8] has six salsas.' }
      )
    });
    expect(r.reply).toBe('Karamelo King [#8] has six salsas.');
  });

  it('keeps a narration-shaped sentence that carries the answer', () => {
    expect(cleanReply('Let me show you Karamelo King [#8], with nine salsas.')).toBe('Let me show you Karamelo King [#8], with nine salsas.');
    expect(cleanReply('Six spots. Let me show you these on the map:')).toBe('Six spots.');
    expect(cleanReply('Sure! Let me search for spots in that area.')).toBe('Sure!');
  });

  it('apply_filters narrows the map to a dish, protein styles included', () => {
    const { fns, actions } = makeTools({ catalog, now });
    const r = fns.apply_filters({ dish: 'carnitas' });
    expect(actions[0].filters).toEqual({ searchText: 'carnitas' });
    expect(r.spots.map((s) => s.est_id)).toEqual(expect.arrayContaining([10, 20, 5, 4]));
  });

  it('seeds a search for the spot the router named', async () => {
    const r = await run("tell me about St. Mary's", {
      router: fakeRouter({ intent: 'spot_fact', spot_name: "St. Mary's Mexican Food", needs_agent: true }),
      agent: fakeModel({ text: 'St. Mary’s Mexican Food [#27] hasn’t been checked yet.' })
    });
    expect(r).toMatchObject({ tier: 't2', escalation_reason: null });
  });

  it('get_spot drops hours for closed spots', () => {
    const { fns } = makeTools({ catalog, now });
    expect(fns.get_spot({ est_id: 23 })).not.toHaveProperty('today');
  });
});

describe('review fixes', () => {
  const nullRouter = {
    withStructuredOutput: () => ({ invoke: async () => ({ raw: { usage_metadata: usage }, parsed: null }) })
  };

  it('falls through to the agent when the route fails to parse', async () => {
    const r = await run('something odd', {
      router: nullRouter,
      agent: fakeModel({ text: 'Not sure what you mean. Try a spot name or a dish.' })
    });
    expect(r).toMatchObject({ tier: 't2', route: null, escalation_reason: 'router_parse_failed' });
  });

  it('T1 find_spot ignores hits that are not on the name', async () => {
    const r = await run('take me to taco bell', {
      router: fakeRouter({ intent: 'find_spot', spot_name: 'Taco Bell' }),
      agent: fakeModel(
        { calls: [call('search_spots', { query: 'Taco Bell' })] },
        { text: 'Taco Bell isn’t on CartoTaco.' }
      )
    });
    expect(r.tier).toBe('t2');
    expect(r.actions).toEqual([]);
  });

  it('accepts spots cited in earlier assistant turns, but not invented ones', async () => {
    const history = [
      { role: 'user', content: 'apson?' },
      { role: 'assistant', content: 'Here’s Tacos Apson [#4]. Also try [#999].' }
    ];
    const followUp = (text) => run('is it open late?', {
      router: fakeRouter({ intent: 'spot_fact', needs_agent: true }),
      agent: fakeModel({ text }),
      escalation: fakeModel({ text: 'Sure.' })
    }, { history });
    expect((await followUp('Tacos Apson [#4] is open til midnight.')).tier).toBe('t2');
    expect((await followUp('Yes, [#999] is.')).escalation_reason).toBe('cited_unseen:999');
  });
});

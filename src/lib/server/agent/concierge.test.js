import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AIMessage } from '@langchain/core/messages';
import { processSites } from '../../siteModel.js';
import { runConcierge } from './concierge.js';
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
    const heats = fns.search_spots({ sort_by: 'heat', limit: 3 }).spots.map((s) => s.heat);
    expect(heats[0]).toBe(8);
    expect(heats).toEqual([...heats].sort((a, b) => b - a));
  });
});

describe('canned replies', () => {
  it('answers trail requests without an agent', async () => {
    const r = await run('plan a bike crawl', { router: fakeRouter({ intent: 'trail' }) });
    expect(r).toMatchObject({ tier: 't1', actions: [] });
    expect(r.reply).toMatch(/Trail button/);
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

  it('get_spot drops hours for closed spots', () => {
    const { fns } = makeTools({ catalog, now });
    expect(fns.get_spot({ est_id: 23 })).not.toHaveProperty('today');
  });
});

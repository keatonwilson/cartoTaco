import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { get } from 'svelte/store';

vi.mock('./supabaseBrowser', () => ({ supabaseBrowser: null }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('./favoritesStore', () => {
  const { writable } = require('svelte/store');
  return { favoriteIds: writable(new Set()) };
});

import { tacoStore, filterConfig, flyToTarget } from './stores.js';
import { defaultFilterConfig } from './siteModel.js';
import { applyIntentFilters } from './intentRules.js';
import { chatMessages, chatPending, ask, undoMessage, clearChat, applyActions } from './agentStore.js';
import { trailModeActive, trailStops, trailTransportMode } from './trailStore.js';
import { comparisonSites, comparisonActive } from './comparisonStore.js';
import { goto } from '$app/navigation';

const rows = JSON.parse(readFileSync(new URL('../../evals/fixtures/sites_snapshot.json', import.meta.url)));

const reply = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));

describe('concierge chat store', () => {
  beforeEach(() => {
    tacoStore.set({ data: rows, loading: false, error: null });
    filterConfig.set({ ...defaultFilterConfig(), searchText: 'apson' });
    flyToTarget.set(null);
    chatMessages.set([]);
  });

  it('applies filters from a reply and undoes them', async () => {
    const before = get(filterConfig);
    globalThis.fetch = reply({
      reply: 'Filtered.', tier: 't0', run_id: null,
      actions: [{ type: 'apply_filters', filters: { proteins: { pork: true }, openNow: true } }]
    });
    await ask('pork open now');

    expect(get(filterConfig)).toMatchObject({ searchText: '', openNow: true, proteins: { pork: true } });
    const msg = get(chatMessages).at(-1);
    undoMessage(msg.id);
    expect(get(filterConfig)).toEqual(before);
    expect(get(chatMessages).at(-1).undo).toBeNull();
  });

  it('replaces the filters the user had, from the defaults the server counted with', async () => {
    filterConfig.set({ ...defaultFilterConfig(), proteins: { ...defaultFilterConfig().proteins, chicken: true }, openNow: true, showClosed: false });
    globalThis.fetch = reply({ reply: 'Filtered.', tier: 't0', run_id: null,
      actions: [{ type: 'apply_filters', filters: { proteins: { pork: true } } }] });
    await ask('pork');
    expect(get(filterConfig)).toEqual(applyIntentFilters(defaultFilterConfig(), { proteins: { pork: true } }));
  });

  it('keeps a dish answer\'s credits on the message and changes nothing on the map', async () => {
    const before = get(filterConfig);
    const items = [{ by: 'Alasdair Baverstock', title: 'Mexican Slang 101', url: 'https://mexiconewsdaily.com/slang' }];
    globalThis.fetch = reply({ reply: 'Two corn tortillas, from Michoacán.', tier: 't2', run_id: null,
      actions: [{ type: 'sources', name: 'Chavindeca', items }] });
    await ask('what is chavindeca?');
    expect(get(chatMessages).at(-1).sources).toEqual(items);
    expect(get(filterConfig)).toEqual(before);
  });

  it('drops a reply that lands after New chat', async () => {
    let answer;
    globalThis.fetch = vi.fn(() => new Promise((r) => { answer = r; }));
    const pending = ask('pork');
    clearChat();
    expect(get(chatPending)).toBe(false);
    answer({ ok: true, json: async () => ({ reply: 'Filtered.', tier: 't0', run_id: null,
      actions: [{ type: 'apply_filters', filters: { proteins: { pork: true } } }] }) });
    await pending;
    expect(get(chatMessages)).toEqual([]);
    expect(get(filterConfig).proteins.pork).toBe(false);
  });

  it('opens a spot, ignores unknown ones, and sends the history', async () => {
    globalThis.fetch = reply({ reply: 'Here’s Tacos Apson [#4].', tier: 't0', run_id: null,
      actions: [{ type: 'show_spot', est_id: 999 }, { type: 'show_spot', est_id: 4 }] });
    await ask('apson');
    expect(get(flyToTarget).est_id).toBe(4);

    await ask('is it open?');
    const body = JSON.parse(globalThis.fetch.mock.calls[1][1].body);
    expect(body.history).toEqual([
      { role: 'user', content: 'apson' },
      { role: 'assistant', content: 'Here’s Tacos Apson [#4].' }
    ]);
  });

  it('shows an error without sending it back as history', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401 }));
    await ask('hi');
    expect(get(chatMessages).at(-1)).toMatchObject({ error: true, content: 'Sign in to use the concierge.' });
  });

  it('builds a trail, fills the compare tray, and opens a prefilled summit', () => {
    applyActions([
      { type: 'plan_trail', est_ids: [4, 2, 999, 8], mode: 'cycling' },
      { type: 'compare', est_ids: [4, 8] },
      { type: 'start_summit', est_ids: [4, 8, 2], title: 'Friday tacos' }
    ]);
    expect(get(trailModeActive)).toBe(true);
    expect(get(trailTransportMode)).toBe('cycling');
    expect(get(trailStops).map((s) => s.est_id)).toEqual([4, 2, 8]);
    expect(get(comparisonSites).map((s) => s.est_id)).toEqual([4, 8]);
    expect(get(comparisonActive)).toBe(true);
    expect(goto).toHaveBeenCalledWith('/vote/new?ids=4%2C8%2C2&title=Friday+tacos');
  });
});

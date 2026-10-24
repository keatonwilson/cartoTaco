import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { get } from 'svelte/store';

vi.mock('./supabaseBrowser', () => ({ supabaseBrowser: null }));
vi.mock('./favoritesStore', () => {
  const { writable } = require('svelte/store');
  return { favoriteIds: writable(new Set()) };
});

import { tacoStore, filterConfig, flyToTarget } from './stores.js';
import { defaultFilterConfig } from './siteModel.js';
import { applyIntentFilters } from './intentRules.js';
import { chatMessages, chatPending, ask, undoMessage, clearChat } from './agentStore.js';

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
});

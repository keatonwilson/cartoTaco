// src/lib/agentStore.js
// The concierge chat: messages, the request to /api/agent, and the actions it
// sends back applied to the map's stores. ChatPanel.svelte draws it.
import { writable, get } from 'svelte/store';
import { processedTacoData, filterConfig, flyToTarget } from './stores';
import { applyIntentFilters } from './intentRules';
import { defaultFilterConfig } from './siteModel';
import { isMobile } from './deviceDetection';
import { chatOpen } from './uiStore';

export const chatPending = writable(false);
/** @type {import('svelte/store').Writable<Array<{ id: number, role: 'user'|'assistant', content: string,
 *   tier?: string, run_id?: string|null, feedback?: 0|1, undo?: object|null, error?: boolean }>>} */
export const chatMessages = writable([]);

let nextId = 1;
// Bumped by clearChat, so a reply to a cleared conversation is dropped
let generation = 0;
const HISTORY_TURNS = 12;

const update = (id, patch) =>
  chatMessages.update((all) => all.map((m) => (m.id === id ? { ...m, ...patch } : m)));

/**
 * Apply the concierge's actions. Returns the filterConfig to restore on Undo,
 * or null when nothing undoable happened (opening a spot is undone by closing it).
 * @param {Array<{ type: string, est_id?: number, filters?: object }>} actions
 */
export function applyActions(actions) {
  let undo = null;
  for (const action of actions) {
    if (action.type === 'apply_filters') {
      // Replace, as the server counted ("23 spots"), keeping only what the
      // concierge can't set: whether pending and closed spots show
      const before = get(filterConfig);
      undo ??= before;
      const fresh = { ...defaultFilterConfig(), showPending: before.showPending, showClosed: before.showClosed };
      filterConfig.set(applyIntentFilters(fresh, action.filters));
    } else if (action.type === 'show_spot') {
      const site = get(processedTacoData).find((s) => s.est_id === action.est_id);
      if (!site) continue;
      flyToTarget.set(site);
      // The spot's bottom sheet and the chat sheet can't share a phone screen
      if (get(isMobile)) chatOpen.set(false);
    }
  }
  return undo;
}

/** Send a question; the reply lands in chatMessages. */
export async function ask(query) {
  query = query.trim();
  if (!query || get(chatPending)) return;
  const history = get(chatMessages)
    .filter((m) => !m.error)
    .slice(-HISTORY_TURNS)
    .map(({ role, content }) => ({ role, content }));
  chatMessages.update((all) => [...all, { id: nextId++, role: 'user', content: query }]);
  chatPending.set(true);
  const asked = generation;

  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, history })
    });
    if (!res.ok) {
      const message = res.status === 401
        ? 'Sign in to use the concierge.'
        : 'Something went wrong. Try again in a moment.';
      throw new Error(message);
    }
    const { reply, actions, tier, run_id } = await res.json();
    if (asked !== generation) return;
    const undo = applyActions(actions);
    chatMessages.update((all) => [...all, { id: nextId++, role: 'assistant', content: reply, tier, run_id, undo }]);
  } catch (err) {
    if (asked !== generation) return;
    const content = err instanceof TypeError ? 'You seem to be offline.' : err.message;
    chatMessages.update((all) => [...all, { id: nextId++, role: 'assistant', content, error: true }]);
  } finally {
    if (asked === generation) chatPending.set(false);
  }
}

/** Put the filters back the way they were before a message changed them. */
export function undoMessage(id) {
  const msg = get(chatMessages).find((m) => m.id === id);
  if (!msg?.undo) return;
  filterConfig.set(msg.undo);
  update(id, { undo: null, undone: true });
}

/** 👍 (1) or 👎 (0) on a reply, attached to its LangSmith trace. */
export async function sendFeedback(id, score) {
  const msg = get(chatMessages).find((m) => m.id === id);
  if (!msg?.run_id || msg.feedback != null) return;
  update(id, { feedback: score });
  const res = await fetch('/api/agent/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: msg.run_id, score })
  }).catch(() => null);
  if (!res?.ok) update(id, { feedback: undefined });
}

export function clearChat() {
  generation++;
  chatPending.set(false);
  chatMessages.set([]);
}

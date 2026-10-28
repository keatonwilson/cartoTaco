// cocina writeups for spot cards (/api/kb), fetched once, the first time a card asks.
import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<{ version: string|null, entries: object, names: object } | null>} */
export const writeups = writable(null);

let pending = null;

export function loadWriteups() {
  pending ??= fetch('/api/kb')
    .then((r) => (r.ok ? r.json() : null))
    .then((index) => {
      writeups.set(index);
      return index;
    })
    .catch(() => {
      pending = null; // a network blip: let the next card try again
      return null;
    });
  return pending;
}

import { describe, it, expect } from 'vitest';
import { writeupIndex, writeupFor } from './kb.js';

const src = (by, url) => ({ title: `${by}'s page`, url, publisher: by, authors: [], quote: 'q', locator: null });
const carnitas = {
  slug: 'carnitas', kind: 'protein_prep', name: 'Carnitas', aliases: ['Carnitas michoacanas'], linked_from: [],
  claims: [
    { id: 1, predicate: 'originates_in', value: 'Michoacán', object: null, sources: [src('Eater', 'https://eater.example/c')] },
    { id: 2, predicate: 'cooking_method', value: 'slow-cooked in lard', object: null, sources: [src('Serious Eats', 'https://se.example/c')] },
    { id: 3, predicate: 'served_with', value: 'salsa verde', object: null, sources: [src('Uncited Blog', 'https://blog.example/c')] }
  ],
  writeup: [
    { text: 'Carnitas is pork from Michoacán.', claims: [1] },
    { text: 'It is slow-cooked in lard.', claims: [2] }
  ]
};
const noWriteup = { ...carnitas, slug: 'birria', name: 'Birria', aliases: [], writeup: null };

describe('spot-card writeups', () => {
  const index = writeupIndex([carnitas, noWriteup]);

  it('finds a specialty by its exact name or alias, any case or accent', () => {
    expect(writeupFor(index, 'carnitas')?.slug).toBe('carnitas');
    expect(writeupFor(index, 'CARNITAS MICHOACANAS')?.slug).toBe('carnitas');
  });

  it('never borrows a near miss, and skips foods with no writeup', () => {
    expect(writeupFor(index, 'Carnita')).toBeNull();
    expect(writeupFor(index, 'Carnitas tacos')).toBeNull();
    expect(writeupFor(index, 'Birria')).toBeNull();
    expect(writeupFor(null, 'Carnitas')).toBeNull(); // not loaded yet: the old text stays
  });

  it('credits only the works behind the claims the sentences cite', () => {
    const w = writeupFor(index, 'Carnitas');
    expect(w.sentences).toEqual(['Carnitas is pork from Michoacán.', 'It is slow-cooked in lard.']);
    expect(w.sources.map((s) => s.by)).toEqual(['Eater', 'Serious Eats']);
  });
});

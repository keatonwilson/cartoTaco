import { describe, it, expect } from 'vitest';
import { parseIntent, applyIntentFilters } from './intentRules.js';

const ALL_OFF = { 'Brick and Mortar': false, Stand: false, Truck: false };

describe('parseIntent', () => {
  it('reads a whole filter query with nothing left over', () => {
    const intent = parseIntent('spicy pork open now, no trucks');
    expect(intent.filters).toEqual({
      proteins: { pork: true },
      types: { 'Brick and Mortar': true, Stand: true, Truck: false },
      spiceLevel: { min: 7, max: 10 },
      openNow: true
    });
    expect(intent.remainder).toBe('');
    expect(intent.covered).toBe(true);
    expect(intent.matched).toEqual(['Pork', 'No trucks', 'Spice 7+', 'Open now']);
  });

  it('includes the types named', () => {
    const intent = parseIntent('taco trucks or stands');
    expect(intent.filters.types).toEqual({ ...ALL_OFF, Truck: true, Stand: true });
    expect(intent.matched).toEqual(['Trucks or stands']);
  });

  it('understands Spanish', () => {
    const intent = parseIntent('tacos de pollo picantes abiertos');
    expect(intent.filters.proteins).toEqual({ chicken: true });
    expect(intent.filters.openNow).toBe(true);
    expect(parseIntent('mariscos muy picante').filters).toEqual({
      proteins: { fish: true },
      spiceLevel: { min: 8, max: 10 }
    });
  });

  it('reads mild and negated heat as a low ceiling', () => {
    expect(parseIntent('mild chicken').filters.spiceLevel).toEqual({ min: 0, max: 4 });
    expect(parseIntent('something not spicy').filters.spiceLevel).toEqual({ min: 0, max: 4 });
  });

  it('does not read a hot dog as heat', () => {
    const intent = parseIntent('sonoran hot dog');
    expect(intent.filters).toEqual({});
    expect(intent.remainder).toBe('hot dog sonoran');
    expect(intent.covered).toBe(false);
  });

  it('keeps what it cannot filter on as a search remainder', () => {
    const intent = parseIntent('spicy al pastor open now');
    expect(intent.filters).toEqual({ spiceLevel: { min: 7, max: 10 }, openNow: true });
    expect(intent.remainder).toBe('al pastor');
    expect(intent.covered).toBe(false);
  });

  it('pulls out a place and handmade tortillas as extras', () => {
    const intent = parseIntent('handmade tortillas near the U of A');
    expect(intent.extras).toEqual({ near: 'the u of a', handmadeTortillas: true });
    expect(intent.covered).toBe(true);
  });

  it('drops a negated protein rather than filtering on it', () => {
    const intent = parseIntent('no pork');
    expect(intent.filters).toEqual({});
    expect(intent.covered).toBe(false);
  });

  it('understands nothing in a plain name', () => {
    const intent = parseIntent('Tacos Apson');
    expect(intent.matched).toEqual([]);
    expect(intent.remainder).toBe('apson');
    expect(intent.covered).toBe(false);
  });

  it('reads favorites', () => {
    expect(parseIntent('my favorites open now').filters).toEqual({ showFavoritesOnly: true, openNow: true });
  });
});

describe('applyIntentFilters', () => {
  it('merges proteins and types over the current config', () => {
    const cfg = {
      searchText: 'x',
      proteins: { chicken: true, beef: false, pork: false, fish: false, veg: false },
      types: { ...ALL_OFF },
      spiceLevel: { min: 0, max: 10 },
      openNow: false
    };
    const next = applyIntentFilters(cfg, { proteins: { pork: true }, openNow: true });
    expect(next.proteins).toEqual({ chicken: true, beef: false, pork: true, fish: false, veg: false });
    expect(next.types).toBe(cfg.types);
    expect(next.openNow).toBe(true);
    expect(next.searchText).toBe('x');
  });
});

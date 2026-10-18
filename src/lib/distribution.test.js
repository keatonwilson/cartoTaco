import { describe, it, expect } from 'vitest';
import { binValues, dotRadius, describeDistribution, contextLine } from './distribution.js';

describe('binValues', () => {
  it('counts spots per value, ascending', () => {
    expect(binValues([4, 6, 4, 2, 4, 6])).toEqual([
      { value: 2, count: 1 },
      { value: 4, count: 3 },
      { value: 6, count: 2 }
    ]);
  });

  it('snaps fractional values to the step', () => {
    expect(binValues([4.4, 4.6, 4.5, 5], 0.5)).toEqual([
      { value: 4.5, count: 3 },
      { value: 5, count: 1 }
    ]);
  });

  it('returns no bins for no values', () => {
    expect(binValues([])).toEqual([]);
  });
});

describe('dotRadius', () => {
  it('scales area, not radius, with count', () => {
    const big = dotRadius(16, 16, { min: 0, max: 8 });
    const quarter = dotRadius(4, 16, { min: 0, max: 8 });
    expect(big).toBe(8);
    expect(quarter).toBe(4);
  });

  it('keeps a single-spot bin visible', () => {
    expect(dotRadius(1, 400, { min: 2, max: 8 })).toBe(2);
  });
});

describe('describeDistribution', () => {
  it('lists each bin and marks this spot', () => {
    const bins = [{ value: 4, count: 30 }, { value: 6, count: 12 }, { value: 9, count: 1 }];
    expect(describeDistribution(bins, 6, (v) => `at heat ${v}`)).toBe(
      '30 spots at heat 4, 12 spots at heat 6 (this one), 1 spot at heat 9'
    );
  });
});

describe('contextLine', () => {
  it('keeps "hotter than" at the median', () => {
    expect(contextLine('heat', 50, 40)).toBe('Hotter than 50% of Tucson spots');
  });

  it('says "milder than" the share strictly above, below the median', () => {
    // 30% below, 20% tied, 50% above — not 100 - 30
    expect(contextLine('heat', 30, 50)).toBe('Milder than 50% of Tucson spots');
  });

  it('names the extremes instead of 0% / 100%', () => {
    expect(contextLine('heat', 90, 0)).toBe('Hottest in Tucson');
    expect(contextLine('heat', 30, 0)).toBe('Hottest in Tucson');
    expect(contextLine('heat', 0, 80)).toBe('Mildest in Tucson');
    expect(contextLine('heat', 0, 0)).toBe('Same heat as every Tucson spot');
  });

  it('uses salsa wording', () => {
    expect(contextLine('salsa', 60, 20)).toBe('More salsa variety than 60% of Tucson spots');
    expect(contextLine('salsa', 10, 70)).toBe('Fewer salsas than 70% of Tucson spots');
    expect(contextLine('salsa', 95, 0)).toBe('Most salsa variety in Tucson');
    expect(contextLine('salsa', 0, 60)).toBe('Fewest salsas in Tucson');
  });

  it('returns null without a percentile', () => {
    expect(contextLine('heat', null, null)).toBeNull();
  });
});

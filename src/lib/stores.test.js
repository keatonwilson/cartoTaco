import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabaseBrowser before importing stores
vi.mock('./supabaseBrowser', () => ({
  supabaseBrowser: null
}));

// Mock favoritesStore before importing stores
vi.mock('./favoritesStore', () => {
  const { writable } = require('svelte/store');
  return { favoriteIds: writable(new Set()) };
});

import { combineArraysByEstId, isOpenNow } from './stores.js';

describe('combineArraysByEstId', () => {
  it('combines multiple arrays by est_id', () => {
    const arrays = [
      [{ est_id: 1, name: 'Birria' }, { est_id: 2, name: 'Mulitas' }],
      [{ est_id: 1, heat: 5 }, { est_id: 2, heat: 3 }]
    ];
    const names = ['item', 'salsa'];
    const result = combineArraysByEstId(arrays, names);

    expect(result).toHaveLength(2);

    const site1 = result.find(r => r.est_id === 1);
    expect(site1.item).toEqual({ name: 'Birria' });
    expect(site1.salsa).toEqual({ heat: 5 });
  });

  it('strips est_id from nested objects', () => {
    const arrays = [[{ est_id: 1, name: 'Test', value: 42 }]];
    const names = ['data'];
    const result = combineArraysByEstId(arrays, names);

    expect(result[0].data.est_id).toBeUndefined();
    expect(result[0].data.name).toBe('Test');
  });

  it('handles null arrays gracefully', () => {
    const arrays = [null, [{ est_id: 1, name: 'Test' }]];
    const names = ['skipped', 'data'];
    const result = combineArraysByEstId(arrays, names);

    expect(result).toHaveLength(1);
    expect(result[0].data.name).toBe('Test');
  });

  it('handles items with missing est_id', () => {
    const arrays = [[{ est_id: 1, name: 'Valid' }, { name: 'No ID' }]];
    const names = ['data'];
    const result = combineArraysByEstId(arrays, names);

    expect(result).toHaveLength(1);
    expect(result[0].est_id).toBe(1);
  });

  it('returns empty array for empty input', () => {
    expect(combineArraysByEstId([], [])).toEqual([]);
  });

  it('merges data from same est_id across arrays', () => {
    const arrays = [
      [{ est_id: 1, a: 1 }],
      [{ est_id: 1, b: 2 }],
      [{ est_id: 1, c: 3 }]
    ];
    const names = ['first', 'second', 'third'];
    const result = combineArraysByEstId(arrays, names);

    expect(result).toHaveLength(1);
    expect(result[0].first).toEqual({ a: 1 });
    expect(result[0].second).toEqual({ b: 2 });
    expect(result[0].third).toEqual({ c: 3 });
  });
});

describe('isOpenNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when currently within open hours', () => {
    // Set to Wednesday 12:00 PM
    vi.setSystemTime(new Date(2026, 1, 18, 12, 0)); // Wed Feb 18, 2026

    const startHours = { wed_start: '9:00' };
    const endHours = { wed_end: '17:00' };

    expect(isOpenNow(startHours, endHours)).toBe(true);
  });

  it('returns false when outside open hours', () => {
    // Set to Wednesday 8:00 PM
    vi.setSystemTime(new Date(2026, 1, 18, 20, 0));

    const startHours = { wed_start: '9:00' };
    const endHours = { wed_end: '17:00' };

    expect(isOpenNow(startHours, endHours)).toBe(false);
  });

  it('returns false when hours are missing for the day', () => {
    // Set to Wednesday
    vi.setSystemTime(new Date(2026, 1, 18, 12, 0));

    const startHours = {};
    const endHours = {};

    expect(isOpenNow(startHours, endHours)).toBe(false);
  });

  it('handles AM/PM time format', () => {
    // Set to Wednesday 2:00 PM
    vi.setSystemTime(new Date(2026, 1, 18, 14, 0));

    const startHours = { wed_start: '11:00 AM' };
    const endHours = { wed_end: '3:00 PM' };

    expect(isOpenNow(startHours, endHours)).toBe(true);
  });

  it('handles midnight-crossing hours', () => {
    // Set to Wednesday 11:00 PM
    vi.setSystemTime(new Date(2026, 1, 18, 23, 0));

    const startHours = { wed_start: '18:00' };
    const endHours = { wed_end: '2:00' };

    expect(isOpenNow(startHours, endHours)).toBe(true);
  });

  it('returns false just before opening', () => {
    // Set to Wednesday 8:59 AM
    vi.setSystemTime(new Date(2026, 1, 18, 8, 59));

    const startHours = { wed_start: '9:00' };
    const endHours = { wed_end: '17:00' };

    expect(isOpenNow(startHours, endHours)).toBe(false);
  });

  it('checks correct day of week', () => {
    // Set to Thursday 12:00 PM
    vi.setSystemTime(new Date(2026, 1, 19, 12, 0));

    // Only Wednesday has hours
    const startHours = { wed_start: '9:00' };
    const endHours = { wed_end: '17:00' };

    expect(isOpenNow(startHours, endHours)).toBe(false);
  });
});

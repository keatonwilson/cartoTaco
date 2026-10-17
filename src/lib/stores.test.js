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

import { isOpenNow } from './stores.js';

// Tucson wall time (UTC-7, no DST) as a fixed instant, so these pass in any runner time zone
const tucson = (day, h, m) => new Date(Date.UTC(2026, 1, day, h + 7, m));

describe('isOpenNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when currently within open hours', () => {
    // Set to Wednesday 12:00 PM
    vi.setSystemTime(tucson(18, 12, 0)); // Wed Feb 18, 2026

    const hours = { wed_start: '9:00', wed_end: '17:00' };

    expect(isOpenNow(hours)).toBe(true);
  });

  it('returns false when outside open hours', () => {
    // Set to Wednesday 8:00 PM
    vi.setSystemTime(tucson(18, 20, 0));

    const hours = { wed_start: '9:00', wed_end: '17:00' };

    expect(isOpenNow(hours)).toBe(false);
  });

  it('returns false when hours are missing for the day', () => {
    // Set to Wednesday
    vi.setSystemTime(tucson(18, 12, 0));

    expect(isOpenNow({})).toBe(false);
  });

  it('returns false when hours object is null', () => {
    vi.setSystemTime(tucson(18, 12, 0));

    expect(isOpenNow(null)).toBe(false);
  });

  it('handles AM/PM time format', () => {
    // Set to Wednesday 2:00 PM
    vi.setSystemTime(tucson(18, 14, 0));

    const hours = { wed_start: '11:00 AM', wed_end: '3:00 PM' };

    expect(isOpenNow(hours)).toBe(true);
  });

  it('handles midnight-crossing hours', () => {
    // Set to Wednesday 11:00 PM
    vi.setSystemTime(tucson(18, 23, 0));

    const hours = { wed_start: '18:00', wed_end: '2:00' };

    expect(isOpenNow(hours)).toBe(true);
  });

  it('stays open after midnight on the previous night\'s hours', () => {
    // Thursday 1:00 AM, inside Wednesday's 18:00–2:00 span
    vi.setSystemTime(tucson(19, 1, 0));

    const hours = { wed_start: '18:00', wed_end: '2:00' };

    expect(isOpenNow(hours)).toBe(true);
  });

  it('uses Tucson time, not the browser clock', () => {
    // 18:30 UTC is 11:30 AM in Tucson, but 1:30 PM on the US east coast
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 18, 18, 30)));

    const hours = { wed_start: '9:00', wed_end: '12:00' };

    expect(isOpenNow(hours)).toBe(true);
  });

  it('returns false just before opening', () => {
    // Set to Wednesday 8:59 AM
    vi.setSystemTime(tucson(18, 8, 59));

    const hours = { wed_start: '9:00', wed_end: '17:00' };

    expect(isOpenNow(hours)).toBe(false);
  });

  it('checks correct day of week', () => {
    // Set to Thursday 12:00 PM
    vi.setSystemTime(tucson(19, 12, 0));

    // Only Wednesday has hours
    const hours = { wed_start: '9:00', wed_end: '17:00' };

    expect(isOpenNow(hours)).toBe(false);
  });
});

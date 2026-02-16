import { describe, it, expect } from 'vitest';
import { calculateDistance, toRad, isWithinTucsonArea } from './geocoding.js';

describe('toRad', () => {
  it('converts 0 degrees to 0 radians', () => {
    expect(toRad(0)).toBe(0);
  });

  it('converts 180 degrees to PI radians', () => {
    expect(toRad(180)).toBeCloseTo(Math.PI);
  });

  it('converts 90 degrees to PI/2 radians', () => {
    expect(toRad(90)).toBeCloseTo(Math.PI / 2);
  });

  it('handles negative degrees', () => {
    expect(toRad(-90)).toBeCloseTo(-Math.PI / 2);
  });
});

describe('calculateDistance', () => {
  it('returns 0 for same point', () => {
    expect(calculateDistance(32.2, -110.9, 32.2, -110.9)).toBe(0);
  });

  it('calculates reasonable distance between Tucson and Phoenix', () => {
    // Tucson: 32.2226, -110.9747
    // Phoenix: 33.4484, -112.0740
    const distance = calculateDistance(32.2226, -110.9747, 33.4484, -112.074);
    // Should be roughly 180 km
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(210);
  });

  it('calculates reasonable distance between nearby Tucson points', () => {
    // Two points ~5km apart in Tucson
    const distance = calculateDistance(32.22, -110.97, 32.26, -110.97);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(6);
  });

  it('is symmetric', () => {
    const d1 = calculateDistance(32.2, -110.9, 33.4, -112.0);
    const d2 = calculateDistance(33.4, -112.0, 32.2, -110.9);
    expect(d1).toBeCloseTo(d2);
  });
});

describe('isWithinTucsonArea', () => {
  it('rejects missing coordinates', () => {
    expect(isWithinTucsonArea(null, -110.9).valid).toBe(false);
    expect(isWithinTucsonArea(32.2, null).valid).toBe(false);
  });

  it('accepts central Tucson coordinates', () => {
    expect(isWithinTucsonArea(32.2226, -110.9747).valid).toBe(true);
  });

  it('rejects coordinates north of Tucson', () => {
    const result = isWithinTucsonArea(33.0, -110.9);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('latitude');
  });

  it('rejects coordinates south of Tucson', () => {
    const result = isWithinTucsonArea(31.5, -110.9);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('latitude');
  });

  it('rejects coordinates east of Tucson', () => {
    const result = isWithinTucsonArea(32.2, -110.0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('longitude');
  });

  it('rejects coordinates west of Tucson', () => {
    const result = isWithinTucsonArea(32.2, -111.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('longitude');
  });

  it('accepts edge of Tucson metro area', () => {
    // Marana area (north edge)
    expect(isWithinTucsonArea(32.4, -111.1).valid).toBe(true);
    // Sahuarita area (south edge)
    expect(isWithinTucsonArea(31.9, -110.9).valid).toBe(true);
  });
});

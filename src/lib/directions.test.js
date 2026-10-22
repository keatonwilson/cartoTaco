import { describe, it, expect } from 'vitest';
import { directionsUrl } from './directions.js';

const spot = { latitude: 32.2, longitude: -110.9, name: 'Taco A' };

describe('directionsUrl', () => {
  it('uses Apple Maps on iOS', () => {
    expect(directionsUrl(spot, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('maps://?q=Taco%20A&ll=32.2,-110.9');
  });

  it('uses a geo: intent on Android', () => {
    expect(directionsUrl(spot, 'Mozilla/5.0 (Linux; Android 14)')).toBe('geo:32.2,-110.9?q=32.2,-110.9(Taco%20A)');
  });

  it('uses Google Maps on the web', () => {
    expect(directionsUrl(spot, 'Mozilla/5.0 (Macintosh)')).toBe('https://www.google.com/maps/search/?api=1&query=32.2,-110.9');
  });
});

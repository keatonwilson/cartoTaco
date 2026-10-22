import { describe, it, expect } from 'vitest';
import { searchSpots, normalize, editDistance } from './search.js';
import { processSites } from './siteModel.js';

// A sites_complete row, with just the fields search reads
function row(estId, name, {
  type = 'Truck',
  region = 'Sonora',
  short = '',
  menu = { taco_yes: true },
  protein = { beef_yes: true },
  styles = {},
  specialties = [],
  closed = false,
  lat = 32.2,
  lon = -110.9
} = {}) {
  return {
    est_id: estId,
    site: {
      est_id: estId, name, type, lat_1: lat, lon_1: lon,
      vetting_status: 'vetted', closed_at: closed ? '2026-05-01' : null,
      address: '123 S 4th Ave, Tucson, AZ'
    },
    descriptions: { short_descrip: short, long_descrip: '', region },
    menu: { ...menu, specialty_items: specialties },
    hours: {},
    salsa: { total_num: 3, heat_overall: 5 },
    protein: { ...protein, ...styles }
  };
}

const sites = processSites([
  row(1, 'El Güero Canelo', { type: 'Brick and Mortar', menu: { taco_yes: true, dog_yes: true } }),
  row(2, 'Tacos Apson', { protein: { beef_yes: true, pork_yes: true }, styles: { pork_style_1: 'Al Pastor' } }),
  row(3, 'Taqueria Pico de Gallo', { short: 'Fruit cups and carne asada', region: 'Jalisco' }),
  row(4, 'Mariscos Chihuahua', { protein: { fish_yes: true }, specialties: [{ name: 'Coctel de camarón' }] }),
  row(5, 'BK Carne Asada', { closed: true, menu: { taco_yes: true, dog_yes: true } }),
  row(6, 'Nowhere Tacos', { lat: null, lon: null }),
  row(7, 'Birrieria Guadalajara', { specialties: [{ name: 'Birria quesataco' }] })
]);

const names = (results) => results.map((r) => r.site.name);

describe('normalize', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalize('  El Güero-Canelo! ')).toBe('el guero canelo');
    expect(normalize('Camarón')).toBe('camaron');
  });
});

describe('editDistance', () => {
  it('counts a transposition as one edit', () => {
    expect(editDistance('pastro', 'pastor')).toBe(1);
    expect(editDistance('apsn', 'apson')).toBe(1);
  });

  it('gives up past the limit', () => {
    expect(editDistance('chicken', 'birria', 2)).toBe(3);
  });
});

// The golden set: what people type → the spot that should come first
describe('searchSpots golden queries', () => {
  const golden = [
    ['apson', 'Tacos Apson'],
    ['tacos apson', 'Tacos Apson'],
    ['apsn', 'Tacos Apson'],
    ['guero canelo', 'El Güero Canelo'],
    ['el güero', 'El Güero Canelo'],
    ['pastor', 'Tacos Apson'],
    ['al pastr', 'Tacos Apson'],
    ['camaron', 'Mariscos Chihuahua'],
    ['coctel', 'Mariscos Chihuahua'],
    ['seafood mariscos', 'Mariscos Chihuahua'],
    ['birria', 'Birrieria Guadalajara'],
    ['jalisco', 'Taqueria Pico de Gallo'],
    ['sonoran hot dog', 'El Güero Canelo'],
    ['restaurant', 'El Güero Canelo']
  ];

  it.each(golden)('"%s" → %s', (query, expected) => {
    const results = searchSpots(query, sites);
    expect(results[0]?.site.name).toBe(expected);
  });
});

describe('searchSpots', () => {
  it('requires every word to match somewhere', () => {
    expect(names(searchSpots('apson birria', sites))).toEqual([]);
  });

  it('ranks closed spots after open ones, even with a better match', () => {
    const results = names(searchSpots('carne asada', sites));
    expect(results).toEqual(['Taqueria Pico de Gallo', 'BK Carne Asada']);
  });

  it('skips spots the map cannot place', () => {
    expect(names(searchSpots('nowhere', sites))).toEqual([]);
  });

  it('says what matched', () => {
    const [hit] = searchSpots('quesataco', sites);
    expect(hit.matchedOn).toEqual({ field: 'specialty', label: 'Birria quesataco' });
  });

  it('keeps stop words when they are the whole query', () => {
    expect(names(searchSpots('el', sites))).toContain('El Güero Canelo');
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(searchSpots('   ', sites)).toEqual([]);
    expect(searchSpots('taco', sites, { limit: 2 })).toHaveLength(2);
  });
});

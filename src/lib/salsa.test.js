import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  inkFor,
  contrast,
  hue,
  shortName,
  spotsForStyle,
  spotCounts,
  sortStyles,
  neighbours,
  seededRandom,
  clusterStyles,
  honeycombLayout,
  CLUSTER_MODES,
  salsaAffinity,
  UNKNOWN_SALSA_DISTANCE
} from './salsa';

const style = (slug, family, palette, heat = [1, 3]) => ({
  slug,
  name: slug,
  family,
  region: family === 'fresca' ? 'south' : 'central',
  palette,
  heat_min: heat[0],
  heat_max: heat[1]
});

const STYLES = [
  style('verde', 'cooked', ['#7a9a2e', '#000000', '#ffffff'], [2, 6]),
  style('rojo', 'cooked', ['#b3261e', '#000000', '#ffffff'], [2, 7]),
  style('pico', 'fresca', ['#d8362f', '#000000', '#ffffff'], [1, 4]),
  style('habanero', 'fresca', ['#f28c1b', '#000000', '#ffffff'], [8, 10])
];

const site = (est_id, name, slugs, extra = {}) => ({
  est_id,
  name,
  isPending: false,
  isClosed: false,
  salsaStyles: slugs.map((slug) => ({ slug, heat: null })),
  ...extra
});

const SITES = [
  site(1, 'Zeta', ['verde', 'rojo']),
  site(2, 'Alpha', ['verde']),
  site(3, 'Closed Co', ['verde'], { isClosed: true }),
  site(4, 'Pending Co', ['verde'], { isPending: true })
];

describe('inkFor', () => {
  it('picks white on dark and black on light', () => {
    expect(inkFor('#2a1a14')).toBe('#ffffff');
    expect(inkFor('#f7dc6f')).toBe('#000000');
  });

  // Every colour a page can use as a background must carry readable text
  it('clears 4.5:1 on every seeded palette colour', () => {
    const dir = 'supabase/migrations';
    const seed = readFileSync(`${dir}/${readdirSync(dir).find((f) => f.includes('036_'))}`, 'utf8');
    const colours = [...new Set(seed.match(/#[0-9a-f]{6}\b/g))];
    expect(colours.length).toBeGreaterThan(40);
    for (const c of colours) {
      expect(contrast(c, inkFor(c)), c).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('hue / shortName', () => {
  it('orders red, green, blue', () => {
    expect(hue('#ff0000')).toBe(0);
    expect(hue('#00ff00')).toBe(120);
    expect(hue('#0000ff')).toBe(240);
    expect(hue('#808080')).toBe(0);
  });

  it('strips only a leading "Salsa (de)"', () => {
    expect(shortName('Salsa de Árbol')).toBe('Árbol');
    expect(shortName('Salsa Verde')).toBe('Verde');
    expect(shortName('Pico de Gallo')).toBe('Pico de Gallo');
  });
});

describe('spotsForStyle / spotCounts', () => {
  it('lists open spots by name, then closed, and never pending', () => {
    expect(spotsForStyle(SITES, 'verde').map((r) => r.site.name)).toEqual(['Alpha', 'Zeta', 'Closed Co']);
    expect(spotsForStyle(SITES, 'nope')).toEqual([]);
  });

  it('counts open vetted spots only', () => {
    const counts = spotCounts(SITES);
    expect(counts.get('verde')).toBe(2);
    expect(counts.get('rojo')).toBe(1);
    expect(counts.has('pico')).toBe(false);
  });
});

describe('sortStyles', () => {
  const slugs = (mode, counts) => sortStyles(STYLES, mode, counts).map((s) => s.slug);

  it('family: catalogue order, then name', () => {
    expect(slugs('family')).toEqual(['habanero', 'pico', 'rojo', 'verde']);
  });
  it('heat: hottest first', () => {
    expect(slugs('heat')[0]).toBe('habanero');
    expect(slugs('heat').at(-1)).toBe('pico');
  });
  it('colour: by hue', () => {
    expect(slugs('colour')).toEqual(['pico', 'rojo', 'habanero', 'verde']);
  });
  it('served: by spot count', () => {
    expect(slugs('served', spotCounts(SITES)).slice(0, 2)).toEqual(['verde', 'rojo']);
  });
  it('does not mutate its input', () => {
    const before = STYLES.map((s) => s.slug);
    sortStyles(STYLES, 'heat');
    expect(STYLES.map((s) => s.slug)).toEqual(before);
  });
});

describe('neighbours', () => {
  it('excludes the style itself and ranks by distance across the axes', () => {
    const result = neighbours(STYLES, STYLES[0], 2).map((s) => s.slug);
    expect(result).not.toContain('verde');
    expect(result[0]).toBe('rojo'); // heat 4.5 vs verde's 4
    expect(result).toHaveLength(2);

    // A flavour axis outweighs a small heat gap
    const smoky = { ...STYLES[2], slug: 'smoky', smoke: 9 };
    const alsoSmoky = { ...STYLES[3], slug: 'also-smoky', smoke: 8 };
    expect(neighbours([...STYLES, smoky, alsoSmoky], smoky, 1)[0].slug).toBe('also-smoky');
  });
});

describe('seededRandom', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = seededRandom('verde');
    const b = seededRandom('verde');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(seededRandom('rojo')()).not.toBe(first[0]);
    expect(first.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('clusterStyles', () => {
  it('groups every style exactly once in every mode', () => {
    for (const { key } of CLUSTER_MODES) {
      const groups = clusterStyles(STYLES, key, spotCounts(SITES));
      expect(groups.flatMap((g) => g.styles.map((s) => s.slug)).sort(), key).toEqual(
        STYLES.map((s) => s.slug).sort()
      );
      expect(groups.every((g) => g.styles.length > 0)).toBe(true);
    }
  });

  it('clusters by colour and by Tucson availability', () => {
    const colour = Object.fromEntries(
      clusterStyles(STYLES, 'colour').map((g) => [g.key, g.styles.map((s) => s.slug)])
    );
    expect(colour.green).toEqual(['verde']);
    expect(colour.red).toEqual(['pico', 'rojo']);
    const tucson = clusterStyles(STYLES, 'tucson', spotCounts(SITES));
    expect(tucson.find((g) => g.key === 'none').styles.map((s) => s.slug)).toEqual(['pico', 'habanero']);
  });
});

describe('honeycombLayout', () => {
  const many = Array.from({ length: 23 }, (_, i) => style(`s${i}`, 'cooked', ['#b3261e', '#000000', '#ffffff']));
  const groups = [
    { key: 'a', label: 'A', styles: many.slice(0, 9) },
    { key: 'b', label: 'B', styles: many.slice(9, 16) },
    { key: 'c', label: 'C', styles: many.slice(16, 22) },
    { key: 'd', label: 'D', styles: many.slice(22) }
  ];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  for (const cols of [4, 7, 12]) {
    it(`places every style once, apart from other clusters, within ${cols} columns`, () => {
      const layout = honeycombLayout(groups, cols);
      expect(layout.cells.size).toBe(23);
      expect(layout.labels).toHaveLength(4);
      expect(layout.width).toBeLessThanOrEqual(cols + 1e-9);

      const owner = new Map(groups.flatMap((g) => g.styles.map((s) => [s.slug, g.key])));
      const entries = [...layout.cells];
      for (const [slugA, a] of entries) {
        for (const [slugB, b] of entries) {
          if (slugA === slugB) continue;
          // same lattice cell never reused; different clusters never touch
          expect(dist(a, b)).toBeGreaterThan(0.99);
          if (owner.get(slugA) !== owner.get(slugB)) expect(dist(a, b)).toBeGreaterThan(1.01);
        }
      }
    });
  }

  it('keeps each cluster contiguous', () => {
    const layout = honeycombLayout(groups, 12);
    for (const g of groups) {
      const pts = g.styles.map((s) => layout.cells.get(s.slug));
      const seen = new Set([0]);
      const queue = [0];
      while (queue.length) {
        const i = queue.pop();
        pts.forEach((p, j) => {
          if (!seen.has(j) && dist(pts[i], p) < 1.01) {
            seen.add(j);
            queue.push(j);
          }
        });
      }
      expect(seen.size, g.key).toBe(pts.length);
    }
  });
});

describe('salsaAffinity', () => {
  const smoky = { slug: 'chipotle', heat_min: 4, heat_max: 6, smoke: 9, acid: 4, sweet: 3, chunk: 2, rich: 3 };
  const alsoSmoky = { slug: 'tatemada', heat_min: 4, heat_max: 5, smoke: 8, acid: 4, sweet: 4, chunk: 3, rich: 2 };
  const bright = { slug: 'verde', heat_min: 2, heat_max: 6, smoke: 1, acid: 8, sweet: 2, chunk: 3, rich: 2 };

  it('is null without favourites', () => {
    expect(salsaAffinity([bright], [])).toBeNull();
  });

  it('measures to the closest salsa on the table and reports exact matches', () => {
    const exact = salsaAffinity([bright, smoky], [smoky]);
    expect(exact.distance).toBe(0);
    expect(exact.matched.map((s) => s.slug)).toEqual(['chipotle']);

    const near = salsaAffinity([bright, alsoSmoky], [smoky]);
    const far = salsaAffinity([bright], [smoky]);
    expect(near.matched).toEqual([]);
    expect(near.distance).toBeGreaterThan(0);
    expect(near.distance).toBeLessThan(far.distance);
  });

  it('treats a spot with no recorded salsas as unknown, not as a mismatch', () => {
    expect(salsaAffinity([], [smoky]).distance).toBe(UNKNOWN_SALSA_DISTANCE);
    expect(salsaAffinity(undefined, [smoky]).matched).toEqual([]);
  });
});

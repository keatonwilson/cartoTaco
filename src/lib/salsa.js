// Pure helpers for the Salsa Atlas (/salsa, /salsa/[slug]).
// Styles come from the salsa_styles table; spots from processedTacoData, whose
// `salsaStyles` carry each spot's links (see migrations 036/037).

// Display order for the "Family" arrangement; keys match the DB CHECK constraint
export const FAMILIES = [
  { key: 'fresca', label: 'Fresca', blurb: 'Raw and chopped' },
  { key: 'cooked', label: 'Cooked', blurb: 'Boiled or roasted' },
  { key: 'dried-chile', label: 'Dried chile', blurb: 'Toasted and blended' },
  { key: 'oil', label: 'Oil', blurb: 'Fried in oil' },
  { key: 'creamy', label: 'Creamy', blurb: 'Emulsified' },
  { key: 'pickled', label: 'Pickled', blurb: 'In vinegar' },
  { key: 'mole', label: 'Mole', blurb: 'Long-cooked' }
];

// Coarse origin buckets; keys match the DB CHECK constraint on salsa_styles.region
export const REGIONS = [
  { key: 'north', label: 'Sonora & the north' },
  { key: 'west', label: 'Baja & the west' },
  { key: 'central', label: 'Central Mexico' },
  { key: 'south', label: 'The south & Yucatán' },
  { key: 'everywhere', label: 'All over Mexico' }
];

// The features the atlas honeycomb can be clustered by
export const CLUSTER_MODES = [
  { key: 'family', label: 'Family' },
  { key: 'colour', label: 'Colour' },
  { key: 'region', label: 'Region' },
  { key: 'heat', label: 'Heat' },
  { key: 'tucson', label: 'In Tucson' }
];

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// WCAG relative luminance
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(hexA, hexB) {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

// Text colour for a salsa-coloured background. Pure black/white on purpose:
// whichever wins always clears 4.5:1, which a softer ink can't guarantee.
export function inkFor(hex) {
  return contrast(hex, '#000000') >= contrast(hex, '#ffffff') ? '#000000' : '#ffffff';
}

// Hue in degrees (0–360); greys sort first
export function hue(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export const midHeat = (style) => ((style.heat_min ?? 0) + (style.heat_max ?? 0)) / 2;

// "Salsa de Árbol" → "Árbol"; names that aren't "Salsa …" are left alone
export const shortName = (name) => name.replace(/^Salsa (de )?/i, '');

// Vetted spots serving a style: open ones first, then closed, each by name.
// Returns [{ site, link }] where link is the spot's own entry for the style
// (per-spot heat, house_name, note).
export function spotsForStyle(sites, slug) {
  return (sites || [])
    .filter((site) => !site.isPending)
    .map((site) => ({ site, link: (site.salsaStyles || []).find((s) => s.slug === slug) }))
    .filter((row) => row.link)
    .sort((a, b) => a.site.isClosed - b.site.isClosed || a.site.name.localeCompare(b.site.name));
}

// Map<slug, number of open vetted spots serving it>
export function spotCounts(sites) {
  const counts = new Map();
  for (const site of sites || []) {
    if (site.isPending || site.isClosed) continue;
    for (const s of site.salsaStyles || []) counts.set(s.slug, (counts.get(s.slug) || 0) + 1);
  }
  return counts;
}

export function sortStyles(styles, mode, counts = new Map()) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const familyIndex = (s) => FAMILIES.findIndex((f) => f.key === s.family);
  const cmp = {
    family: (a, b) => familyIndex(a) - familyIndex(b) || byName(a, b),
    heat: (a, b) => midHeat(b) - midHeat(a) || byName(a, b),
    colour: (a, b) => hue(a.palette[0]) - hue(b.palette[0]) || byName(a, b),
    served: (a, b) => (counts.get(b.slug) || 0) - (counts.get(a.slug) || 0) || byName(a, b)
  }[mode];
  return [...styles].sort(cmp || byName);
}

// The axes a salsa can be placed on: typical heat plus the five flavour
// columns of salsa_styles (each 0–10). `low`/`high` name the two ends.
export const AXES = [
  { key: 'heat', label: 'Heat', low: 'mild', high: 'fierce' },
  { key: 'smoke', label: 'Smoke', low: 'clean', high: 'smoky' },
  { key: 'acid', label: 'Acidity', low: 'mellow', high: 'sharp' },
  { key: 'sweet', label: 'Sweetness', low: 'savoury', high: 'sweet' },
  { key: 'chunk', label: 'Texture', low: 'smooth', high: 'chunky' },
  { key: 'rich', label: 'Richness', low: 'lean', high: 'rich' }
];

export const axisValue = (style, key) => (key === 'heat' ? midHeat(style) : (style[key] ?? 0));

// Up to n close relatives: the nearest styles across all six axes, with the
// same family breaking ties
export function neighbours(styles, style, n = 5) {
  const gap = (s) => Math.hypot(...AXES.map((a) => axisValue(s, a.key) - axisValue(style, a.key)));
  return styles
    .filter((s) => s.slug !== style.slug)
    .sort((a, b) => gap(a) - gap(b) || (b.family === style.family) - (a.family === style.family))
    .slice(0, n);
}

// A style as a point in flavour space: the six axes, each scaled to 0–1
export const flavourVector = (style) => AXES.map((a) => axisValue(style, a.key) / 10);

// How a spot's salsas sit against the salsas a user has favourited.
// Returns null when there are no favourites (nothing to compare against),
// otherwise { distance, matched }:
//   distance  0–√6: from the user's taste (the centre of their favourites) to
//             the spot's *closest* salsa. Closest, not average: one salsa you
//             would love is a reason to go, whatever else is on the table.
//   matched   the spot's styles that are themselves favourites
// A spot with no recorded styles gets a middling distance: unknown, not bad.
export const UNKNOWN_SALSA_DISTANCE = 1;
export function salsaAffinity(siteStyles, favourites) {
  if (!favourites || favourites.length === 0) return null;
  const vectors = favourites.map(flavourVector);
  const taste = vectors[0].map((_, i) => vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length);
  const gap = (style) => Math.hypot(...flavourVector(style).map((v, i) => v - taste[i]));
  const styles = siteStyles || [];
  return {
    distance: styles.length ? Math.min(...styles.map(gap)) : UNKNOWN_SALSA_DISTANCE,
    matched: styles.filter((s) => favourites.some((f) => f.slug === s.slug))
  };
}

// Deterministic PRNG (mulberry32) seeded from a string, so generated art is
// identical on the server and the client and stable across visits.
export function seededRandom(seed) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// HSL lightness (0–1)
function lightness(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

// Colour family of a hex code. Very dark and near-grey colours group as
// "Charred" whatever their hue, because that is how they read on the page.
function colourGroup(hex) {
  const [r, g, b] = rgb(hex);
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  if (lightness(hex) < 0.27 || chroma < 0.1) return 'charred';
  const h = hue(hex);
  if (h < 12 || h >= 330) return 'red';
  if (h < 40) return 'orange';
  if (h < 68) return 'gold';
  return 'green';
}

// For each mode: the ordered groups, and how to find a style's group
const CLUSTERINGS = {
  family: { groups: FAMILIES, of: (s) => s.family },
  region: { groups: REGIONS, of: (s) => s.region },
  colour: {
    groups: [
      { key: 'red', label: 'Reds' },
      { key: 'orange', label: 'Oranges' },
      { key: 'gold', label: 'Golds' },
      { key: 'green', label: 'Greens' },
      { key: 'charred', label: 'Charred & stone' }
    ],
    of: (s) => colourGroup(s.palette[0])
  },
  heat: {
    groups: [
      { key: 'mild', label: 'Mild' },
      { key: 'medium', label: 'Medium' },
      { key: 'hot', label: 'Hot' },
      { key: 'fierce', label: 'Fierce' }
    ],
    of: (s) => {
      const h = midHeat(s);
      return h < 3.5 ? 'mild' : h < 5 ? 'medium' : h < 7 ? 'hot' : 'fierce';
    }
  },
  tucson: {
    groups: [
      { key: 'everywhere', label: 'On most tables' },
      { key: 'common', label: 'Easy to find' },
      { key: 'rare', label: 'A few spots' },
      { key: 'none', label: 'Not yet spotted' }
    ],
    of: (s, counts) => {
      const n = counts.get(s.slug) || 0;
      return n === 0 ? 'none' : n <= 3 ? 'rare' : n < 12 ? 'common' : 'everywhere';
    }
  }
};

// Styles grouped for a cluster mode: [{ key, label, styles }], empty groups
// dropped. Within a group, styles run in hue order so neighbours look alike.
export function clusterStyles(styles, mode, counts = new Map()) {
  const { groups, of } = CLUSTERINGS[mode] || CLUSTERINGS.family;
  const byHue = sortStyles(styles, 'colour');
  return groups
    .map((g) => ({ ...g, styles: byHue.filter((s) => of(s, counts) === g.key) }))
    .filter((g) => g.styles.length > 0);
}

// ── Honeycomb layout ─────────────────────────────────────────────────────────
// Pointy-top hexagons on axial coordinates (q, r). One unit is the centre-to-
// centre distance between horizontal neighbours.
const ROW = Math.sqrt(3) / 2;
const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const cellX = ([q, r]) => q + r / 2;
const cellKey = ([q, r]) => `${q},${r}`;

// The first n cells of a hexagonal spiral out from the origin: a compact blob
function spiral(n) {
  const cells = [[0, 0]];
  for (let ring = 1; cells.length < n; ring++) {
    let q = 0;
    let r = -ring;
    for (const [dq, dr] of DIRS) {
      for (let step = 0; step < ring; step++) {
        cells.push([q, r]);
        q += dq;
        r += dr;
      }
    }
  }
  return cells.slice(0, n);
}

// Place each group as its own blob on one shared lattice, biggest nearest the
// middle, with at least one empty cell between blobs so clusters read as
// clusters. `maxCols` caps the width in cells, so a narrow screen grows the
// hive downward instead of sideways.
// Returns positions in units: { cells: Map<slug, {x, y}>, labels: [{ key, label, x, y }], width, height }
export function honeycombLayout(groups, maxCols = 12) {
  const half = Math.max(1, (maxCols - 1) / 2);
  const taken = new Set(); // occupied cells
  const blocked = new Set(); // occupied cells and their neighbours
  const origins = spiral(1500);
  // Lower is better: how far a blob sits from the middle. Height costs more
  // than width so the hive spreads sideways before it grows down the page.
  const spread = (cells) => cells.reduce((sum, c) => sum + cellX(c) ** 2 + (c[1] * ROW * 1.7) ** 2, 0);
  const placed = [];

  for (const group of [...groups].sort((a, b) => b.styles.length - a.styles.length)) {
    const shape = spiral(group.styles.length);
    const at = ([oq, or]) => shape.map(([q, r]) => [q + oq, r + or]);
    const fits = (cells) => cells.every((c) => !blocked.has(cellKey(c)) && Math.abs(cellX(c)) <= half);
    // ponytail: brute force over 1500 candidate origins per cluster; fine for
    // tens of salsas. Falls back to the origin if nothing fits.
    const cells = origins
      .map(at)
      .filter(fits)
      .reduce((best, c) => (!best || spread(c) < spread(best) ? c : best), null) || at([0, 0]);
    for (const cell of cells) {
      taken.add(cellKey(cell));
      blocked.add(cellKey(cell));
      for (const [dq, dr] of DIRS) blocked.add(cellKey([cell[0] + dq, cell[1] + dr]));
    }
    placed.push({ group, cells });
  }

  const all = placed.flatMap((p) => p.cells);
  const minX = Math.min(...all.map(cellX));
  const minR = Math.min(...all.map(([, r]) => r));
  const toUnits = (cell) => ({ x: cellX(cell) - minX, y: (cell[1] - minR) * ROW });

  const cells = new Map();
  const labels = [];
  for (const { group, cells: groupCells } of placed) {
    groupCells.forEach((cell, i) => cells.set(group.styles[i].slug, toUnits(cell)));
    // Label sits over the blob's top row, centred on that row
    const top = Math.min(...groupCells.map(([, r]) => r));
    const topRow = groupCells.filter(([, r]) => r === top).map(cellX);
    labels.push({
      key: group.key,
      label: group.label,
      x: (Math.min(...topRow) + Math.max(...topRow)) / 2 - minX,
      y: (top - minR) * ROW
    });
  }

  return {
    cells,
    labels,
    width: Math.max(...all.map(cellX)) - minX + 1,
    height: (Math.max(...all.map(([, r]) => r)) - minR) * ROW + 2 / Math.sqrt(3)
  };
}

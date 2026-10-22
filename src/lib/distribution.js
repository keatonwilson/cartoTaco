// Helpers for the city-distribution context on Card: binning for
// ContextStrip and the "Hotter than / Milder than" percentile lines (issue #80).

/** Group values into bins of `step`, ascending: [{ value, count }] */
export function binValues(values, step = 1) {
  const counts = new Map();
  for (const v of values) {
    const key = Math.round(v / step) * step;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value, count }));
}

/**
 * Dot radius whose area is proportional to the bin's count, floored at `min`
 * so a single-spot bin stays visible.
 */
export function dotRadius(count, maxCount, { min = 1.5, max = 8 } = {}) {
  if (!maxCount) return min;
  return Math.max(min, max * Math.sqrt(count / maxCount));
}

/** Screen-reader text: "30 spots at heat 4, 12 spots at heat 6 (this one), …" */
export function describeDistribution(bins, highlight, binLabel) {
  return bins
    .map(({ value, count }) =>
      `${count} ${count === 1 ? 'spot' : 'spots'} ${binLabel(value)}${value === highlight ? ' (this one)' : ''}`
    )
    .join(', ');
}

const WORDING = {
  heat: {
    above: (x) => `Hotter than ${x}% of Tucson spots`,
    below: (y) => `Milder than ${y}% of Tucson spots`,
    top: 'Hottest in Tucson',
    bottom: 'Mildest in Tucson',
    tiedTop: 'Tied for hottest in Tucson',
    tiedBottom: 'Tied for mildest in Tucson',
    allTied: 'Same heat as every Tucson spot'
  },
  salsa: {
    above: (x) => `More salsa variety than ${x}% of Tucson spots`,
    below: (y) => `Fewer salsas than ${y}% of Tucson spots`,
    top: 'Most salsa variety in Tucson',
    bottom: 'Fewest salsas in Tucson',
    tiedTop: 'Tied for most salsa variety in Tucson',
    tiedBottom: 'Tied for fewest salsas in Tucson',
    allTied: 'Same salsa count as every Tucson spot'
  }
};

/**
 * Context line from the share of spots strictly below (`below`) and strictly
 * above (`above`) this one. distributionStats only reports 0 when no spot is
 * on that side, so the extremes are exact. `tied` = another spot shares this
 * value. Leads with the larger side, so a big tie group in the middle doesn't
 * read "Milder than 10%" for a spot hotter than 40%. Null without a percentile.
 */
export function contextLine(kind, below, above, tied = false) {
  if (below === null || below === undefined) return null;
  const w = WORDING[kind];
  if (above === null || above === undefined) return w.above(below);
  if (below === 0 && above === 0) return w.allTied;
  if (above === 0) return tied ? w.tiedTop : w.top;
  if (below === 0) return tied ? w.tiedBottom : w.bottom;
  return below >= above ? w.above(below) : w.below(above);
}

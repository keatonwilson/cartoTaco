// src/lib/chartTheme.js
//
// Single source of truth for chart styling (F3/F4 of the UI refresh).
// Every chart component builds its options from these helpers so all charts
// share one voice: same fonts, same ink/grid colors, same tooltip chrome,
// same palettes.
//
// Palettes were validated (lightness band, chroma floor, adjacent-pair CVD
// separation, contrast vs. surface) against the app's real surfaces:
// #ffffff in light mode, #1f2937 in dark mode. Light slots 1 and 3 carry a
// sub-3:1 contrast WARN — legal only because our charts direct-label their
// marks; keep doing so.

/**
 * Categorical palette — identity. Assign hues in this fixed order, never
 * cycled, and keep the color on the entity (e.g. chicken is always slot 1
 * wherever proteins appear). Max 5 simultaneous series by design.
 */
export const CATEGORICAL = {
	light: ['#FE795D', '#2A9D8F', '#E9A03B', '#6366F1', '#B5179E'],
	dark: ['#E85535', '#2A9D8F', '#C2851A', '#7C7FF2', '#C75DA8']
};

/**
 * Sequential ramp — magnitude (heat levels, density, percentiles).
 * One hue, light→dark: the Tailwind `primary` coral scale.
 */
export const SEQUENTIAL = [
	'#FFF1EE', // 100
	'#FFE4DE', // 200
	'#FFD5CC', // 300
	'#FFBCAD', // 400
	'#FE795D', // 500
	'#EF562F', // 600
	'#EB4F27', // 700
	'#CC4522', // 800
	'#A5371B' // 900
];

/** Brand accent (categorical slot 1 / sequential mid) per mode. */
export function accent(isDark) {
	return isDark ? CATEGORICAL.dark[0] : CATEGORICAL.light[0];
}

/** First n categorical colors for the mode. */
export function seriesColors(isDark, n = 5) {
	return (isDark ? CATEGORICAL.dark : CATEGORICAL.light).slice(0, n);
}

/**
 * Read a CSS design token off :root, with a fallback for SSR/tests.
 * Charts call this at (re)build time so a theme flip re-reads fresh values.
 */
export function readToken(name, fallback) {
	if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

/** Font stack for chart text — mirrors --font-text. */
export const CHART_FONT = "'Inter Variable', system-ui, sans-serif";

/** Ink + grid tokens for chart scaffolding (axes, labels, gridlines). */
export function chartInk(isDark) {
	return {
		label: readToken('--chart-ink', isDark ? '#9ca3af' : '#6b7280'),
		strong: readToken('--ink-1', isDark ? '#f9fafb' : '#111827'),
		grid: readToken('--chart-grid', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
	};
}

/** Shared ECharts tooltip chrome. Spread into any option's `tooltip`. */
export function tooltipStyle(isDark) {
	const ink = chartInk(isDark);
	return {
		backgroundColor: readToken('--chart-tooltip-bg', isDark ? '#1f2937' : '#ffffff'),
		borderColor: readToken('--chart-tooltip-border', isDark ? '#374151' : '#e5e7eb'),
		borderWidth: 1,
		padding: [8, 10],
		textStyle: {
			color: ink.strong,
			fontFamily: CHART_FONT,
			fontSize: 12
		},
		extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 8px;'
	};
}

/** Shared ECharts base text style (axis labels, legends). */
export function baseTextStyle(isDark) {
	return {
		color: chartInk(isDark).label,
		fontFamily: CHART_FONT,
		fontSize: 11
	};
}

/** Convert a hex color to an rgba() string at the given alpha (for fills). */
export function withAlpha(hex, alpha) {
	const h = hex.replace('#', '');
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

/** Five-point star symbol path for ECharts (centroid markers etc.). */
export const STAR_PATH =
	'path://M50 5 L61.8 38.2 L97.5 38.2 L68.7 59.5 L79.4 93.5 L50 72.5 L20.6 93.5 L31.3 59.5 L2.5 38.2 L38.2 38.2 Z';

// Tucson Taco Census aggregates (N2 of the UI refresh).
// Everything derives client-side from processedTacoData — no new queries.
import { derived } from 'svelte/store';
import { processedTacoData, isOpenNow } from './stores';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** "11:00 AM" / "23:30" → minutes since midnight, or null */
function parseTime(s) {
	if (!s || s === 'NA') return null;
	const [time, period] = String(s).trim().split(' ');
	let [h, m] = time.split(':').map(Number);
	if (isNaN(h)) return null;
	if (period) {
		if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
		if (period.toUpperCase() === 'AM' && h === 12) h = 0;
	}
	return h * 60 + (m || 0);
}

export const censusStats = derived(processedTacoData, ($sites) => {
	if (!$sites || $sites.length === 0) return null;
	const n = $sites.length;

	// ── Hero stats ──
	const openNow = $sites.filter((s) => isOpenNow(s.rawData?.hours)).length;
	const avgHeat = $sites.reduce((a, s) => a + (s.heatOverall || 0), 0) / n;
	const totalSalsas = $sites.reduce((a, s) => a + (s.salsaCount || 0), 0);
	const newest =
		[...$sites]
			.filter((s) => s.createdAt)
			.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

	// ── Menu prevalence: share of spots serving each item type ──
	const menuCounts = {};
	for (const s of $sites) {
		const menu = s.rawData?.menu || {};
		for (const [key, val] of Object.entries(menu)) {
			if (key.endsWith('_yes') && val === true) {
				const item = key.slice(0, -4);
				menuCounts[item] = (menuCounts[item] || 0) + 1;
			}
		}
	}
	const menuPrevalence = Object.entries(menuCounts)
		.map(([item, count]) => ({ item, count, pct: Math.round((count / n) * 100) }))
		.sort((a, b) => b.count - a.count);

	// ── Protein leaderboard (fixed taxonomy order) ──
	const proteins = ['chicken', 'beef', 'pork', 'fish', 'veg'].map((p) => ({
		protein: p,
		count: $sites.filter((s) => s.rawData?.protein?.[`${p}_yes`] === true).length,
		pct: Math.round(
			($sites.filter((s) => s.rawData?.protein?.[`${p}_yes`] === true).length / n) * 100
		)
	}));

	// ── Heat histogram (0–10, rounded) ──
	const heatHistogram = Array.from({ length: 11 }, (_, i) => ({
		heat: i,
		count: $sites.filter((s) => Math.round(s.heatOverall || 0) === i).length
	}));

	// ── Tortilla split ──
	const tortilla = { flour: 0, corn: 0, both: 0, handmade: 0 };
	for (const s of $sites) {
		const t = String(s.tortillaType || '').toLowerCase();
		if (t.includes('both')) tortilla.both++;
		else if (t.includes('flour')) tortilla.flour++;
		else if (t.includes('corn')) tortilla.corn++;
		if (s.handmadeTortilla) tortilla.handmade++;
	}

	// ── "When can you get a taco?" 7×24 grid of open-spot counts ──
	// Overnight spans credit the post-midnight hours to the next day's row.
	const openGrid = DAY_KEYS.map(() => Array(24).fill(0));
	for (const s of $sites) {
		const hours = s.rawData?.hours || {};
		DAY_KEYS.forEach((day, d) => {
			const start = parseTime(hours[`${day}_start`]);
			const end = parseTime(hours[`${day}_end`]);
			if (start === null || end === null) return;
			for (let h = 0; h < 24; h++) {
				const mid = h * 60 + 30;
				if (end > start) {
					if (mid >= start && mid < end) openGrid[d][h]++;
				} else {
					// Overnight: tonight's portion on this row…
					if (mid >= start) openGrid[d][h]++;
					// …and the after-midnight portion on the next day's row
					if (mid < end) openGrid[(d + 1) % 7][h]++;
				}
			}
		});
	}
	const maxOpenCount = Math.max(1, ...openGrid.flat());

	// ── Growth timeline: cumulative spots by created_at ──
	const growth = [...$sites]
		.filter((s) => s.createdAt)
		.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
		.map((s, i) => ({ date: s.createdAt, count: i + 1, name: s.name }));

	return {
		totalSpots: n,
		openNow,
		avgHeat,
		totalSalsas,
		newest,
		menuPrevalence,
		proteins,
		heatHistogram,
		tortilla,
		openGrid,
		maxOpenCount,
		growth
	};
});

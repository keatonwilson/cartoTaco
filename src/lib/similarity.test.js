import { describe, it, expect } from 'vitest';
import { buildSimilarityIndex, similarSpots, textAffinities } from './similarity.js';
import { knnRecommend, TEXT_WEIGHT } from './recommend.js';

const spot = (est_id, extra = {}) => ({
	est_id,
	name: `Spot ${est_id}`,
	latitude: 32.22,
	longitude: -110.97,
	isPending: false,
	isClosed: false,
	topFiveProteinItems: ['beef'],
	topFiveProteinValues: [1],
	heatOverall: 5,
	salsaCount: 4,
	...extra
});

// 1 reads like 2 (0.9) more than like 3 (0.8); 4 is pending, 5 closed, 6 unplaceable
const rows = [
	{ est_id_a: 1, est_id_b: 2, score: 0.9 },
	{ est_id_a: 1, est_id_b: 3, score: 0.8 },
	{ est_id_a: 1, est_id_b: 4, score: 0.99 },
	{ est_id_a: 1, est_id_b: 5, score: 0.98 },
	{ est_id_a: 1, est_id_b: 6, score: 0.97 },
	{ est_id_a: 2, est_id_b: 3, score: 0.7 },
	{ est_id_a: 3, est_id_b: 5, score: 0.85 }
];
const catalog = [
	spot(1),
	spot(2),
	spot(3),
	spot(4, { isPending: true }),
	spot(5, { isClosed: true }),
	spot(6, { latitude: null, longitude: null })
];

describe('buildSimilarityIndex', () => {
	it('is symmetric and skips self-pairs and bad scores', () => {
		const index = buildSimilarityIndex([...rows, { est_id_a: 7, est_id_b: 7, score: 1 }, { est_id_a: 1, est_id_b: 8, score: null }]);
		expect(index.get(2).get(1)).toBe(0.9);
		expect(index.get(1).get(2)).toBe(0.9);
		expect(index.has(7)).toBe(false);
		expect(index.get(1).has(8)).toBe(false);
	});

	it('handles no rows', () => {
		expect(buildSimilarityIndex(null).size).toBe(0);
	});
});

describe('similarSpots', () => {
	const index = buildSimilarityIndex(rows);

	it('ranks by score and suggests only open, vetted, placeable spots', () => {
		expect(similarSpots(index, 1, catalog).map((r) => r.site.est_id)).toEqual([2, 3]);
	});

	it('works from a closed spot, suggesting open ones', () => {
		expect(similarSpots(index, 5, catalog).map((r) => r.site.est_id)).toEqual([1, 3]);
	});

	it('respects k and is empty without data', () => {
		expect(similarSpots(index, 1, catalog, 1)).toHaveLength(1);
		expect(similarSpots(null, 1, catalog)).toEqual([]);
		expect(similarSpots(index, 99, catalog)).toEqual([]);
	});
});

describe('textAffinities', () => {
	const index = buildSimilarityIndex(rows);

	it('rescales each favourite over the candidates and keeps the best favourite', () => {
		const aff = textAffinities(index, [spot(1)], [spot(2), spot(3)]);
		expect(aff.get(2)).toEqual({ score: 1, because: expect.objectContaining({ est_id: 1 }) });
		expect(aff.get(3).score).toBe(0);
	});

	it('takes the best match across favourites, not the average', () => {
		// 3 is the weakest match for 1 but the only candidate scored from 5
		const aff = textAffinities(index, [spot(1), spot(5)], [spot(2), spot(3)]);
		expect(aff.get(3)).toEqual({ score: 1, because: expect.objectContaining({ est_id: 5 }) });
	});

	it('is empty without data', () => {
		expect(textAffinities(null, [spot(1)], [spot(2)]).size).toBe(0);
		expect(textAffinities(new Map(), [spot(1)], [spot(2)]).size).toBe(0);
	});
});

describe('knnRecommend with description similarity', () => {
	// Two candidates identical on the 7 numeric dimensions
	const candidates = [spot(2), spot(3)];
	const target = [0, 1, 0, 0, 0, 0.5, 1];

	it('breaks a numeric tie toward the spot that reads like a favourite', () => {
		const textAffinity = new Map([[3, { score: 1, because: spot(1) }], [2, { score: 0, because: spot(1) }]]);
		const recs = knnRecommend(target, candidates, 4, [], 2, { textAffinity });
		expect(recs.map((r) => r.est_id)).toEqual([3, 2]);
		expect(recs[0].because.est_id).toBe(1);
		expect(recs[0].similarity).toBeGreaterThan(recs[1].similarity);
		expect(TEXT_WEIGHT).toBeGreaterThan(0);
	});

	it('is unchanged without similarity data', () => {
		const plain = knnRecommend(target, candidates, 4, [], 2);
		const empty = knnRecommend(target, candidates, 4, [], 2, { textAffinity: new Map() });
		expect(empty).toEqual(plain);
		expect(plain[0].because).toBeNull();
	});
});

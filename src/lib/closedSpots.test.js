import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('./supabaseBrowser', () => ({ supabaseBrowser: null }));
// mapping.js imports the popup cards; stubs keep phosphor-svelte out of the run
vi.mock('../components/Card.svelte', () => ({ default: class { $destroy() {} } }));
vi.mock('../components/PendingSpotCard.svelte', () => ({ default: class { $destroy() {} } }));
vi.mock('mapbox-gl', () => ({ default: { Popup: class {} } }));
vi.mock('./favoritesStore', async () => {
  const { writable } = await import('svelte/store');
  return { favoriteIds: writable(new Set()) };
});

import {
  tacoStore,
  processedTacoData,
  summaryStats,
  distributionStats,
  filterConfig,
  filteredTacoData
} from './stores.js';
import { censusStats } from './censusStore.js';
import { sitesToGeoJSON } from './mapping.js';
import { trailStops, addStop, clearStops } from './trailStore.js';

// A site as returned by the sites_complete view. Closed spots keep every
// measurement we recorded while they were open — only closed_at is set.
function site(estId, { heat = 5, salsas = 4, closedAt = null, vetting = 'vetted' } = {}) {
  return {
    est_id: estId,
    site: {
      est_id: estId,
      name: `Spot ${estId}`,
      type: 'Truck',
      lat_1: 32.2,
      lon_1: -110.9,
      created_at: '2026-01-01T00:00:00Z',
      vetting_status: vetting,
      source: 'editorial',
      source_url: null,
      closed_at: closedAt
    },
    descriptions: { short_descrip: 'Great tacos', long_descrip: 'Really great tacos', region: 'Sonora' },
    menu: { taco_yes: true, taco_perc: 0.8, torta_yes: true, torta_perc: 0.2, flour_corn: 'Corn' },
    // Open every day, so the Open Now filter can't pass/fail for hours reasons
    hours: Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].flatMap((d) => [
        [`${d}_start`, '0:00'],
        [`${d}_end`, '23:59']
      ])
    ),
    salsa: { total_num: salsas, heat_overall: heat, verde_yes: true },
    protein: { beef_yes: true, beef_perc: 1.0 }
  };
}

function resetFilters() {
  filterConfig.set({
    searchText: '',
    proteins: { chicken: false, beef: false, pork: false, fish: false, veg: false },
    types: { 'Brick and Mortar': false, Stand: false, Truck: false },
    spiceLevel: { min: 0, max: 10 },
    openNow: false,
    showFavoritesOnly: false,
    showPending: true,
    showClosed: true,
    styleFilters: { chicken: [], beef: [], pork: [], fish: [], veg: [] }
  });
}

describe('closed spot gating', () => {
  beforeEach(() => {
    resetFilters();
    clearStops();
    tacoStore.setData([
      site(1, { heat: 4, salsas: 3 }),
      site(2, { heat: 8, salsas: 6 }),
      site(3, { heat: 10, salsas: 12, closedAt: '2026-03-15T00:00:00Z' })
    ]);
  });

  describe('processedTacoData', () => {
    it('flags closed sites but keeps the data recorded while they were open', () => {
      const closed = get(processedTacoData).find((s) => s.est_id === 3);
      expect(closed.isClosed).toBe(true);
      expect(closed.closedAt).toBe('2026-03-15T00:00:00Z');
      expect(closed.topFiveMenuItems).toContain('taco');
      expect(closed.salsaVarieties).toEqual([{ name: 'Verde' }]);
      expect(closed.heatOverall).toBe(10);
    });

    it('treats a null closed_at as open', () => {
      expect(get(processedTacoData).find((s) => s.est_id === 1).isClosed).toBe(false);
    });
  });

  describe('city-wide stats', () => {
    it('excludes closed sites from summaryStats', () => {
      const stats = get(summaryStats);
      // Site 3's 10 heat / 12 salsas would move both figures if it counted
      expect(stats.avgHeatLevel).toBe(6);
      expect(stats.maxHeatLevel).toBe(8);
      expect(stats.maxSalsaNum).toBe(6);
    });

    it('gives closed sites no percentile entry and keeps them out of the pool', () => {
      const stats = get(distributionStats);
      expect(stats.has(3)).toBe(false);
      expect(stats.get(2).heatPercentile).toBe(50);
    });

    it('leaves closed sites out of the census and reports them separately', () => {
      const stats = get(censusStats);
      expect(stats.totalSpots).toBe(2);
      expect(stats.closedCount).toBe(1);
      expect(stats.avgHeat).toBe(6);
    });
  });

  describe('filteredTacoData', () => {
    it('shows closed sites by default', () => {
      expect(get(filteredTacoData).map((s) => s.est_id)).toContain(3);
    });

    it('hides closed sites when showClosed is off', () => {
      filterConfig.update((cfg) => ({ ...cfg, showClosed: false }));
      expect(get(filteredTacoData).map((s) => s.est_id)).toEqual([1, 2]);
    });

    it('drops closed sites from Open Now even when their hours say open', () => {
      filterConfig.update((cfg) => ({ ...cfg, openNow: true }));
      const ids = get(filteredTacoData).map((s) => s.est_id);
      expect(ids).toEqual([1, 2]);
    });
  });

  describe('sitesToGeoJSON', () => {
    it('marks closed features and prefixes their label', () => {
      const closed = get(processedTacoData).find((s) => s.est_id === 3);
      const [feature] = sitesToGeoJSON([closed]).features;
      expect(feature.properties.closed).toBe(true);
      expect(feature.properties.label).toBe('✕ Spot 3');
    });

    it('lets closed outrank pending when a spot is both', () => {
      tacoStore.setData([site(4, { closedAt: '2026-03-15T00:00:00Z', vetting: 'pending' })]);
      const both = get(processedTacoData)[0];
      const [feature] = sitesToGeoJSON([both]).features;
      expect(feature.properties.closed).toBe(true);
      expect(feature.properties.vetting_status).toBe('pending');
      expect(feature.properties.label).toBe('✕ Spot 4');
    });
  });

  describe('trail stops', () => {
    it('refuses to add a closed spot to a trail', () => {
      const [open, , closed] = get(processedTacoData);
      addStop(closed);
      expect(get(trailStops)).toHaveLength(0);
      addStop(open);
      expect(get(trailStops).map((s) => s.est_id)).toEqual([1]);
    });
  });
});

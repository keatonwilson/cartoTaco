import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { vi } from 'vitest';

// Mock supabaseBrowser before importing stores
vi.mock('./supabaseBrowser', () => ({
  supabaseBrowser: null
}));

// Mock favoritesStore before importing stores
vi.mock('./favoritesStore', () => {
  const { writable } = require('svelte/store');
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

// A vetted site as returned by the sites_complete view
function vettedSite(estId, { heat = 5, salsas = 4 } = {}) {
  return {
    est_id: estId,
    site: {
      est_id: estId,
      name: `Vetted Spot ${estId}`,
      type: 'Truck',
      lat_1: 32.2,
      lon_1: -110.9,
      created_at: '2026-01-01T00:00:00Z',
      vetting_status: 'vetted',
      source: 'editorial',
      source_url: null
    },
    descriptions: { short_descrip: 'Great tacos', long_descrip: 'Really great tacos', region: 'Sonora' },
    menu: { taco_yes: true, taco_perc: 0.8, torta_yes: true, torta_perc: 0.2, flour_corn: 'Corn' },
    hours: { mon_start: '9:00', mon_end: '17:00' },
    salsa: { total_num: salsas, heat_overall: heat, verde_yes: true },
    protein: { beef_yes: true, beef_perc: 1.0 }
  };
}

// A pending (web-scraped) site: no menu/protein/salsa rows, so the view's
// LEFT JOINs produce objects whose fields are all null
function pendingSite(estId) {
  return {
    est_id: estId,
    site: {
      est_id: estId,
      name: `Pending Spot ${estId}`,
      type: 'Truck',
      lat_1: 32.3,
      lon_1: -110.8,
      created_at: '2026-07-01T00:00:00Z',
      vetting_status: 'pending',
      source: 'web_scrape',
      source_url: 'https://example.com/menu'
    },
    descriptions: { short_descrip: 'Scraped description', long_descrip: null, region: null },
    menu: { taco_yes: null, taco_perc: null, flour_corn: null },
    hours: { mon_start: null, mon_end: null },
    salsa: { total_num: null, heat_overall: null },
    protein: { beef_yes: null, beef_perc: null }
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
    styleFilters: { chicken: [], beef: [], pork: [], fish: [], veg: [] }
  });
}

describe('pending spot gating', () => {
  beforeEach(() => {
    resetFilters();
    tacoStore.setData([vettedSite(1, { heat: 4, salsas: 3 }), vettedSite(2, { heat: 8, salsas: 6 }), pendingSite(3)]);
  });

  describe('processedTacoData', () => {
    it('flags pending sites and passes them through with empty pre-computed arrays', () => {
      const sites = get(processedTacoData);
      expect(sites).toHaveLength(3);

      const pending = sites.find((s) => s.est_id === 3);
      expect(pending.isPending).toBe(true);
      expect(pending.vettingStatus).toBe('pending');
      expect(pending.sourceUrl).toBe('https://example.com/menu');
      expect(pending.topFiveMenuItems).toEqual([]);
      expect(pending.topFiveProteinItems).toEqual([]);
      expect(pending.salsaVarieties).toEqual([]);
      expect(pending.otherSalsas).toEqual([]);
    });

    it('treats sites without vetting_status as vetted (legacy rows)', () => {
      const legacy = vettedSite(9);
      delete legacy.site.vetting_status;
      tacoStore.setData([legacy]);

      const sites = get(processedTacoData);
      expect(sites[0].isPending).toBe(false);
      expect(sites[0].vettingStatus).toBe('vetted');
    });
  });

  describe('summaryStats', () => {
    it('excludes pending sites from max/avg computation', () => {
      const stats = get(summaryStats);
      // Averages over the two vetted sites only — a pending zero would give 4
      expect(stats.avgHeatLevel).toBe(6);
      expect(stats.avgSalsaNum).toBe(4.5);
      expect(stats.maxHeatLevel).toBe(8);
    });
  });

  describe('distributionStats', () => {
    it('gives pending sites no percentile entry and excludes them from pools', () => {
      const stats = get(distributionStats);
      expect(stats.has(3)).toBe(false);
      // With only the two vetted sites in the pool, site 2 beats exactly one of two
      expect(stats.get(2).heatPercentile).toBe(50);
    });
  });

  describe('filteredTacoData', () => {
    it('shows pending sites by default', () => {
      expect(get(filteredTacoData).map((s) => s.est_id)).toContain(3);
    });

    it('hides pending sites when showPending is off', () => {
      filterConfig.update((cfg) => ({ ...cfg, showPending: false }));
      const ids = get(filteredTacoData).map((s) => s.est_id);
      expect(ids).not.toContain(3);
      expect(ids).toHaveLength(2);
    });

    it('excludes pending sites when a protein filter is active', () => {
      filterConfig.update((cfg) => ({ ...cfg, proteins: { ...cfg.proteins, beef: true } }));
      expect(get(filteredTacoData).map((s) => s.est_id)).toEqual([1, 2]);
    });

    it('still matches pending sites in text search', () => {
      filterConfig.update((cfg) => ({ ...cfg, searchText: 'Pending Spot 3' }));
      expect(get(filteredTacoData).map((s) => s.est_id)).toEqual([3]);
    });
  });

  describe('censusStats', () => {
    it('aggregates vetted spots only and reports the pending count', () => {
      const stats = get(censusStats);
      expect(stats.totalSpots).toBe(2);
      expect(stats.pendingCount).toBe(1);
      expect(stats.avgHeat).toBe(6);
    });
  });
});

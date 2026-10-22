// src/lib/stores.js

// imports
import { writable, derived } from "svelte/store";
import { supabaseBrowser } from "./supabaseBrowser";
import { favoriteIds } from "./favoritesStore";
import {
  processSites,
  computeSummaryStats,
  computeDistributionPool,
  computeDistributionStats,
  hasValidCoordinates,
  matchesFilters
} from "./siteModel";

// Re-exported so existing imports from stores keep working
export { hasValidCoordinates, isOpenNow } from "./siteModel";

// Create store that includes data and loading/error state
function createDataStore() {
  const { subscribe, set, update } = writable({
    data: [],
    loading: false,
    error: null
  });

  return {
    subscribe,
    set,
    update,
    setData: (data) => update(store => ({ ...store, data, loading: false })),
    setLoading: (loading) => update(store => ({ ...store, loading })),
    setError: (error) => update(store => ({ ...store, error, loading: false }))
  };
}

// Create stores with loading and error states
export const tacoStore = createDataStore();

// Derived store for overall loading state
export const isLoading = derived(
  tacoStore,
  ($tacoStore) => $tacoStore.loading
);

// Derived store for overall error state
export const hasError = derived(
  tacoStore,
  ($tacoStore) => $tacoStore.error
);

// Derived store for processed taco data with pre-computed values
export const processedTacoData = derived(
  tacoStore,
  ($tacoStore) => processSites($tacoStore.data)
);

// Derived store for summary statistics, computed from processedTacoData
// (replaces the old static summaries table)
export const summaryStats = derived(processedTacoData, computeSummaryStats);

// The city distribution the percentiles and the Card context strip are drawn
// from. Pending (unvetted) spots have no measurements and closed spots are no
// longer part of the city: neither may shift anyone's rank.
export const distributionPool = derived(processedTacoData, computeDistributionPool);

// Derived store for per-spot percentile ranks within the city distribution
// (powers "Hotter than X%" / "Milder than Y%" context lines).
// *Percentile = share of spots strictly lower; *PercentileAbove = share
// strictly higher. Ties count as neither, so Above is not 100 - Percentile.
// *Tied = another spot shares this value ("Tied for hottest").
export const distributionStats = derived(distributionPool, computeDistributionStats);

// Derived store for recently added sites (last 30 days)
export const recentlyAddedSites = derived(
  processedTacoData,
  ($processedTacoData) => {
    if (!$processedTacoData || $processedTacoData.length === 0) {
      return [];
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return $processedTacoData
      .filter(site => {
        if (!site.createdAt) return false;
        // Clicking a badge entry flies the map to it, so an unplaceable spot
        // has nowhere to go
        if (!hasValidCoordinates(site)) return false;
        const createdDate = new Date(site.createdAt);
        return createdDate >= thirtyDaysAgo;
      })
      .sort((a, b) => {
        // Sort by newest first
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA;
      });
  }
);

// Selected site store for popup details
export const selectedSite = writable(null);

// Signal store for programmatic fly-to requests (e.g. Surprise Me button).
// Map.svelte watches this and calls flyToSite() with its local map instance.
export const flyToTarget = writable(null);

// Filter configuration store
export const filterConfig = writable({
  searchText: '',
  proteins: {
    chicken: false,
    beef: false,
    pork: false,
    fish: false,
    veg: false
  },
  types: {
    'Brick and Mortar': false,
    'Stand': false,
    'Truck': false
  },
  spiceLevel: { min: 0, max: 10 },
  openNow: false,
  showFavoritesOnly: false,
  showPending: true,
  showClosed: true,
  styleFilters: {
    chicken: [],
    beef: [],
    pork: [],
    fish: [],
    veg: []
  }
});

// Derived store for filtered taco data
export const filteredTacoData = derived(
  [processedTacoData, filterConfig, favoriteIds],
  ([$processedTacoData, $filterConfig, $favoriteIds]) => {
    if (!$processedTacoData || $processedTacoData.length === 0) {
      return [];
    }

    return $processedTacoData.filter(site => matchesFilters(site, $filterConfig, $favoriteIds));
  }
);

// async fetch data function - optimized to use single view query
export async function fetchSiteData() {
  // Guard against SSR or missing client
  if (!supabaseBrowser) {
    console.warn("Supabase client not available (SSR mode)");
    return;
  }

  // Set loading state
  tacoStore.setLoading(true);

  try {
    // Fetch all site data from the optimized view in a single query
    let { data: sitesCompleteData, error: sitesCompleteError } = await supabaseBrowser
      .from("sites_complete")
      .select();

    if (sitesCompleteError) {
      console.error("Error fetching complete site data:", sitesCompleteError);
      tacoStore.setError(sitesCompleteError);
      return;
    }

    // The view returns data already structured with nested objects
    // No need for client-side combining anymore!
    tacoStore.setData(sitesCompleteData);
  } catch (error) {
    console.error("Error in fetchSiteData:", error);
    tacoStore.setError(error);
  }
}

// Initialize data fetching
// Note: Called from +layout.svelte onMount to prevent
// SSR build errors when supabaseBrowser is null.
// Summary stats are now computed client-side from processedTacoData.
export function initializeStores() {
  fetchSiteData();
}

// src/lib/stores.js

// imports
import { writable, derived } from "svelte/store";
import { supabaseBrowser } from "./supabaseBrowser";
import { filterObjectByKeySubstring, getTopFive } from "./dataWrangling";
import { favoriteIds } from "./favoritesStore";

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
export const summaryStore = createDataStore();

// Derived store for overall loading state
export const isLoading = derived(
  [tacoStore, summaryStore],
  ([$tacoStore, $summaryStore]) => {
    return $tacoStore.loading || $summaryStore.loading;
  }
);

// Derived store for overall error state
export const hasError = derived(
  [tacoStore, summaryStore],
  ([$tacoStore, $summaryStore]) => {
    return $tacoStore.error || $summaryStore.error;
  }
);

// Derived store for processed taco data with pre-computed values
export const processedTacoData = derived(
  tacoStore,
  ($tacoStore) => {
    if (!$tacoStore.data || $tacoStore.data.length === 0) {
      return [];
    }

    return $tacoStore.data.map(site => {
      // Skip sites with missing required data
      if (!site.site || !site.descriptions || !site.menu ||
          !site.hours || !site.salsa || !site.protein) {
        return null;
      }

      try {
        // Pre-compute values used by components
        const menuPercs = filterObjectByKeySubstring(site.menu, "perc");
        const proteinPercs = filterObjectByKeySubstring(site.protein, "perc");
        const startHours = filterObjectByKeySubstring(site.hours, "start");
        const endHours = filterObjectByKeySubstring(site.hours, "end");

        // Pre-compute top five menu items and proteins
        const menuArray = getTopFive(menuPercs);
        const topFiveMenuItems = menuArray.map(subArray => subArray[0]);
        // Convert to numbers and multiply by 100 to get percentages
        const topFiveMenuValues = menuArray.map(subArray => {
          const value = parseFloat(subArray[1]);
          return isNaN(value) ? 0 : value * 100;
        });

        const proteinArray = getTopFive(proteinPercs);
        const topFiveProteinItems = proteinArray.map(subArray => subArray[0]);
        // Convert to numbers and multiply by 100 to get percentages
        const topFiveProteinValues = proteinArray.map(subArray => {
          const value = parseFloat(subArray[1]);
          return isNaN(value) ? 0 : value * 100;
        });
        
        // Return processed site data with pre-computed values
        return {
          est_id: site.est_id,
          site: site.site,
          // Basic site details
          name: site.site.name,
          type: site.site.type,
          longitude: site.site.lon_1,
          latitude: site.site.lat_1,
          createdAt: site.site.created_at, // Track creation date for "new spots" feature

          // Descriptions
          shortDescription: site.descriptions.short_descrip,
          longDescription: site.descriptions.long_descrip,

          // Hours (pre-processed)
          startHours,
          endHours,

          // Menu data (pre-processed)
          menuItems: menuPercs,
          topFiveMenuItems,
          topFiveMenuValues,

          // Protein data (pre-processed)
          menuProtein: proteinPercs,
          topFiveProteinItems,
          topFiveProteinValues,

          // Salsa and spice data
          salsaCount: site.salsa.total_num,
          heatOverall: site.salsa.heat_overall,

          // Other details
          tortillaType: site.menu.flour_corn,

          // Specialty items — embedded in the view, no separate fetch needed
          specialties: [
            ...(site.menu.specialty_items || []).map(s => ({ ...s, type: 'Item' })),
            ...(site.protein.specialty_proteins || []).map(s => ({ ...s, type: 'Protein' })),
            ...(site.salsa.specialty_salsas || []).map(s => ({ ...s, type: 'Salsa' }))
          ],

          // Original data (for complex processing that can't be pre-computed)
          rawData: site
        };
      } catch (error) {
        console.error(`Error processing site ${site.est_id}:`, error);
        return null;
      }
    }).filter(site => site !== null); // Remove null entries
  }
);

// Derived store for summary statistics with proper fallbacks
export const summaryStats = derived(
  summaryStore,
  ($summaryStore) => {
    if (!$summaryStore.data || $summaryStore.data.length === 0) {
      return {
        maxSalsaNum: 0,
        avgSalsaNum: 0,
        maxHeatLevel: 0,
        avgHeatLevel: 0
      };
    }
    
    const summary = $summaryStore.data[0] || {};
    
    return {
      maxSalsaNum: summary.max_salsa_num || 0,
      avgSalsaNum: summary.avg_salsa_num || 0,
      maxHeatLevel: summary.max_heat_level || 0,
      avgHeatLevel: summary.avg_heat_level || 0
    };
  }
);

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
  showFavoritesOnly: false
});

// Helper function to check if a location is currently open
export function isOpenNow(startHours, endHours) {
  const now = new Date();
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = days[now.getDay()];

  const startKey = `${today}_start`;
  const endKey = `${today}_end`;

  const startTime = startHours[startKey];
  const endTime = endHours[endKey];

  if (!startTime || !endTime) return false;

  // Parse time strings (assuming format like "11:00" or "11:00 AM")
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (period) {
      if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
      if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }

    return hours * 60 + minutes;
  };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  if (startMinutes === null || endMinutes === null) return false;

  // Handle times that cross midnight
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// Derived store for filtered taco data
export const filteredTacoData = derived(
  [processedTacoData, filterConfig, favoriteIds],
  ([$processedTacoData, $filterConfig, $favoriteIds]) => {
    if (!$processedTacoData || $processedTacoData.length === 0) {
      return [];
    }

    return $processedTacoData.filter(site => {
      // Favorites only filter
      if ($filterConfig.showFavoritesOnly) {
        if (!$favoriteIds.has(site.est_id)) {
          return false;
        }
      }

      // Search text filter (name)
      if ($filterConfig.searchText) {
        const searchLower = $filterConfig.searchText.toLowerCase();
        if (!site.name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Protein filters
      const activeProteins = Object.entries($filterConfig.proteins)
        .filter(([_, isActive]) => isActive)
        .map(([protein, _]) => protein);

      if (activeProteins.length > 0) {
        const hasAnyProtein = activeProteins.some(protein => {
          const proteinKey = `${protein}_yes`;
          return site.rawData?.protein?.[proteinKey] === true;
        });
        if (!hasAnyProtein) return false;
      }

      // Type filters
      const activeTypes = Object.entries($filterConfig.types)
        .filter(([_, isActive]) => isActive)
        .map(([type, _]) => type);

      if (activeTypes.length > 0) {
        if (!activeTypes.includes(site.type)) {
          return false;
        }
      }

      // Spice level filter
      const siteSpiceLevel = site.heatOverall || 0;
      if (siteSpiceLevel < $filterConfig.spiceLevel.min ||
          siteSpiceLevel > $filterConfig.spiceLevel.max) {
        return false;
      }

      // Open now filter
      if ($filterConfig.openNow) {
        if (!isOpenNow(site.startHours, site.endHours)) {
          return false;
        }
      }

      return true;
    });
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

export async function fetchSummaryData() {
  // Guard against SSR or missing client
  if (!supabaseBrowser) {
    console.warn("Supabase client not available (SSR mode)");
    return;
  }

  // Set loading state
  summaryStore.setLoading(true);

  try {
    // Fetch summary data
    let { data: summaryData, error: summaryError } = await supabaseBrowser
      .from("summaries")
      .select();
    if (summaryError) {
      console.error("Error fetching summaries:", summaryError);
      summaryStore.setError(summaryError);
      return;
    }

    summaryStore.setData(summaryData);
  } catch (error) {
    console.error("Error in fetchSummaryData:", error);
    summaryStore.setError(error);
  }
}

// Initialize data fetching
// Note: These are now called from +layout.svelte onMount to prevent
// SSR build errors when supabaseBrowser is null
export function initializeStores() {
  fetchSiteData();
  fetchSummaryData();
  // Specialty data is now lazy-loaded per site when the popup opens
}

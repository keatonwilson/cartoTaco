// src/lib/stores.js

// imports
import { writable, derived } from "svelte/store";
import { supabase } from "./supabase";

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

function combineArraysByEstId(arrays, names) {
  const combined = {};

  arrays.forEach((array, index) => {
    if (!array) return; // Skip null or undefined arrays
    
    array.forEach((item) => {
      if (!item || !item.est_id) return; // Skip invalid items
      
      const est_id = item.est_id;
      combined[est_id] = combined[est_id] || {};
      combined[est_id][names[index]] = { ...item };
      delete combined[est_id][names[index]].est_id;
    });
  });

  return Object.keys(combined).map((est_id) => ({
    est_id: parseInt(est_id),
    ...combined[est_id],
  }));
}

// Create stores with loading and error states
export const tacoStore = createDataStore();
export const summaryStore = createDataStore();
export const specStore = createDataStore();

// Derived store for overall loading state
export const isLoading = derived(
  [tacoStore, summaryStore, specStore],
  ([$tacoStore, $summaryStore, $specStore]) => {
    return $tacoStore.loading || $summaryStore.loading || $specStore.loading;
  }
);

// Derived store for overall error state
export const hasError = derived(
  [tacoStore, summaryStore, specStore],
  ([$tacoStore, $summaryStore, $specStore]) => {
    return $tacoStore.error || $summaryStore.error || $specStore.error;
  }
);

// async fetch data function (currently sites and descriptions)
export async function fetchSiteData() {
  // Set loading state
  tacoStore.setLoading(true);
  
  try {
    // Fetch sites
    let { data: sitesData, error: sitesError } = await supabase
      .from("sites")
      .select();
    if (sitesError) {
      console.error("Error fetching sites:", sitesError);
      tacoStore.setError(sitesError);
      return;
    }

    // Fetch descriptions
    let { data: descriptionsData, error: descriptionsError } = await supabase
      .from("descriptions")
      .select();
    if (descriptionsError) {
      console.error("Error fetching descriptions:", descriptionsError);
      tacoStore.setError(descriptionsError);
      return;
    }

    // fetch menu data
    let { data: menuData, error: menuError } = await supabase
      .from("menu")
      .select();
    if (menuError) {
      console.error("Error fetching menu data:", menuError);
      tacoStore.setError(menuError);
      return;
    }

    // fetch hours data
    let { data: hoursData, error: hoursError } = await supabase
      .from("hours")
      .select();
    if (hoursError) {
      console.error("Error fetching hours data:", hoursError);
      tacoStore.setError(hoursError);
      return;
    }

    // fetch salsa data
    let { data: salsaData, error: salsaError } = await supabase
      .from("salsa")
      .select();
    if (salsaError) {
      console.error("Error fetching salsa data:", salsaError);
      tacoStore.setError(salsaError);
      return;
    }

    // fetch protein data
    let { data: proteinData, error: proteinError } = await supabase
      .from("protein")
      .select();
    if (proteinError) {
      console.error("Error fetching protein data:", proteinError);
      tacoStore.setError(proteinError);
      return;
    }

    // combine data
    const combinedArray = [
      sitesData,
      descriptionsData,
      menuData,
      hoursData,
      salsaData,
      proteinData,
    ];
    const namesArray = [
      "site",
      "descriptions",
      "menu",
      "hours",
      "salsa",
      "protein",
    ];
    const aggregate = combineArraysByEstId(combinedArray, namesArray);

    // Update the store with the new data
    tacoStore.setData(aggregate);
  } catch (error) {
    console.error("Error in fetchSiteData:", error);
    tacoStore.setError(error);
  }
}

export async function fetchSummaryData() {
  // Set loading state
  summaryStore.setLoading(true);
  
  try {
    // Fetch summary data
    let { data: summaryData, error: summaryError } = await supabase
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

export async function fetchSpecialtyData() {
  // Set loading state
  specStore.setLoading(true);
  
  try {
    // Fetch item specialties
    let { data: itemSpecData, error: itemSpecError } = await supabase
      .from("item_spec")
      .select();
    if (itemSpecError) {
      console.error("Error fetching specialty items:", itemSpecError);
      specStore.setError(itemSpecError);
      return;
    }

    // Fetch protein specialties
    let { data: proteinSpecData, error: proteinSpecError } = await supabase
      .from("protein_spec")
      .select();
    if (proteinSpecError) {
      console.error("Error fetching specialty proteins:", proteinSpecError);
      specStore.setError(proteinSpecError);
      return;
    }

    // Fetch salsa specialties
    let { data: salsaSpecData, error: salsaSpecError } = await supabase
      .from("salsa_spec")
      .select();
    if (salsaSpecError) {
      console.error("Error fetching specialty salsas:", salsaSpecError);
      specStore.setError(salsaSpecError);
      return;
    }

    // combine data
    const specCombinedArray = [
      itemSpecData,
      proteinSpecData, 
      salsaSpecData
    ];
    const specNamesArray = [
      "itemSpec", 
      "proteinSpec", 
      "salsaSpec"
    ];
    const specAggregate = combineArraysByEstId(specCombinedArray, specNamesArray);

    // Update the store with the new data
    specStore.setData(specAggregate);
  } catch (error) {
    console.error("Error in fetchSpecialtyData:", error);
    specStore.setError(error);
  }
}

// Initialize data fetching
fetchSiteData();
fetchSummaryData();
fetchSpecialtyData();

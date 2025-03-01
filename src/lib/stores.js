// src/lib/stores.js

// imports
import { writable, derived } from "svelte/store";
import { supabase } from "./supabase";
import { filterObjectByKeySubstring, getTopFive } from "./dataWrangling";

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
        const topFiveMenuValues = menuArray.map(subArray => subArray[1]);
        
        const proteinArray = getTopFive(proteinPercs);
        const topFiveProteinItems = proteinArray.map(subArray => subArray[0]);
        const topFiveProteinValues = proteinArray.map(subArray => subArray[1]);
        
        // Return processed site data with pre-computed values
        return {
          est_id: site.est_id,
          site: site.site,
          // Basic site details
          name: site.site.name,
          type: site.site.type,
          longitude: site.site.lon_1,
          latitude: site.site.lat_1,
          
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

// Derived store for specialty items by site
export const specialtiesBySite = derived(
  [specStore, processedTacoData],
  ([$specStore, $processedTacoData]) => {
    const specialtyMap = new Map();
    
    // Sample specialty data for demonstration - indexed by est_id
    const sampleSpecialties = {
      // El Antojo Poblano (assuming est_id 1)
      1: {
        itemSpecs: [
          { name: 'Cemita', description: 'Pueblan super-torta with chipotle, queso oaxaca, avocado & a variety of proteins.' },
          { name: 'Tacos Árabes', description: 'Marinated pork on a pita-like tortilla with lime and salsa roja.' }
        ],
        proteinSpecs: [
          { name: 'Milanesa', description: 'Breaded and fried pork or chicken cutlet, seasoned with traditional herbs.' }
        ],
        salsaSpecs: [
          { name: 'Salsa Macha', description: 'Oil-based hot sauce with dried chilies, garlic, and peanuts.' }
        ]
      },
      // Maico's (assuming est_id 2)
      2: {
        itemSpecs: [
          { name: 'Mulitas', description: 'Two tortillas filled with cheese, meat, and topped with guacamole.' },
          { name: 'Vampiros', description: 'Grilled tortilla until crispy, topped with cheese and carne asada.' }
        ],
        proteinSpecs: [
          { name: 'Carne Asada', description: 'Marinated and grilled beef, cut into small strips with perfect char.' }
        ],
        salsaSpecs: [
          { name: 'Salsa Verde Taquera', description: 'Roasted tomatillos, serranos, and avocado blended into a smooth sauce.' }
        ]
      },
      // BOCA (assuming est_id 3)
      3: {
        itemSpecs: [
          { name: 'Quesatacos', description: 'Tortillas with melted cheese, meat, and corn pico de gallo.' },
          { name: 'Seafood Tostadas', description: 'Crispy tortilla topped with marinated seafood and avocado.' }
        ],
        proteinSpecs: [
          { name: 'Camaron', description: 'Marinated shrimp cooked with garlic, lime, and mild spices.' }
        ],
        salsaSpecs: [
          { name: 'Habanero Mango', description: 'Sweet mango balanced with fiery habanero peppers and lime juice.' }
        ]
      },
      // Sample placeholder for others
      4: {
        itemSpecs: [
          { name: 'Birria Tacos', description: 'Slow-cooked beef tacos served with rich consommé for dipping.' }
        ],
        proteinSpecs: [
          { name: 'Barbacoa', description: 'Slow-cooked beef seasoned with chiles and spices until tender.' }
        ],
        salsaSpecs: [
          { name: 'Chile de Árbol', description: 'Bright, spicy red salsa made from toasted chile de árbol peppers.' }
        ]
      }
    };
    
    // If we have real data from the database, use it
    if ($specStore.data && $specStore.data.length > 0) {
      // Create a map of site IDs to processed specialty data
      $specStore.data.forEach(spec => {
        if (!spec || !spec.est_id) return;
        
        const siteSpecialties = {
          itemSpecs: spec.itemSpec ? [spec.itemSpec] : [],
          proteinSpecs: spec.proteinSpec ? [spec.proteinSpec] : [],
          salsaSpecs: spec.salsaSpec ? [spec.salsaSpec] : []
        };
        
        specialtyMap.set(spec.est_id, siteSpecialties);
      });
    } 
    
    // For demonstration, add sample data for any site that doesn't have specialty data
    if ($processedTacoData && $processedTacoData.length > 0) {
      $processedTacoData.forEach(site => {
        if (!site || !site.est_id) return;
        
        // If this site doesn't have specialty data yet
        if (!specialtyMap.has(site.est_id)) {
          // Get sample specialty data based on site ID or use generic data
          const sampleData = sampleSpecialties[site.est_id] || sampleSpecialties[4];
          specialtyMap.set(site.est_id, sampleData);
        }
      });
    }
    
    return specialtyMap;
  }
);

// Selected site store for popup details
export const selectedSite = writable(null);

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

// src/lib/stores.js

// imports
import { writable } from "svelte/store";
import { supabase } from "./supabase";

function combineArraysByEstId(arrays, names) {
  const combined = {};

  arrays.forEach((array, index) => {
    array.forEach((item) => {
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

// export a writable store for core data
export const tacoStore = writable({ combinedSites: [] });
export const summaryStore = writable({ summaries: [] });
export const specStore = writable({ specialties: []})

// async fetch data function (currently sites and descriptions)
export async function fetchSiteData() {
  // Fetch sites
  let { data: sitesData, error: sitesError } = await supabase
    .from("sites")
    .select();
  if (sitesError) {
    console.error("Error fetching sites:", sitesError);
    sitesData = [];
  }

  // Fetch descriptions
  let { data: descriptionsData, error: descriptionsError } = await supabase
    .from("descriptions")
    .select();
  if (descriptionsError) {
    console.error("Error fetching descriptions:", descriptionsError);
    descriptionsData = [];
  }

  // fetch menu data
  let { data: menuData, error: menuError } = await supabase
    .from("menu")
    .select();
  if (descriptionsError) {
    console.error("Error fetching menu data:", menuError);
    menuData = [];
  }

  // fetch menu data
  let { data: hoursData, error: hoursError } = await supabase
    .from("hours")
    .select();
  if (descriptionsError) {
    console.error("Error fetching hours data:", hoursError);
    hoursData = [];
  }

  // fetch salsa data
  let { data: salsaData, error: salsaError } = await supabase
    .from("salsa")
    .select();
  if (descriptionsError) {
    console.error("Error fetching salsa data:", salsaError);
    salsaData = [];
  }

  // fetch protein data
  let { data: proteinData, error: proteinError } = await supabase
    .from("protein")
    .select();
  if (descriptionsError) {
    console.error("Error fetching protein data:", proteinError);
    proteinData = [];
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

  // Use the set method of the writable store to update the state
  tacoStore.set(aggregate);
}

fetchSiteData();

export async function fetchSummaryData() {
    // Fetch summary data
  let { data: summaryData, error: summaryError } = await supabase
    .from("summaries")
    .select();
  if (summaryError) {
    console.error("Error fetching summaries:", summariesError);
    summariesData = [];
  }
  summaryStore.set(summaryData);
}

fetchSummaryData();

export async function fetchSpecialtyData() {
  // Fetch item specialties
let { data: itemSpecData, error: itemSpecError } = await supabase
  .from("item_spec")
  .select();
if (itemSpecError) {
  console.error("Error fetching specialty items:", itemSpecError);
  itemSpecData = [];
}

  // Fetch protein specialties
  let { data: proteinSpecData, error: proteinSpecError } = await supabase
  .from("protein_spec")
  .select();
if (proteinSpecError) {
  console.error("Error fetching specialty proteins:", proteinSpecError);
  proteinSpecData = [];
}

  // Fetch protein specialties
  let { data: salsaSpecData, error: salsaSpecError } = await supabase
  .from("salsa_spec")
  .select();
if (salsaSpecError) {
  console.error("Error fetching specialty salsas:", salsaSpecError);
  salsaSpecData = [];
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

// Use the set method of the writable store to update the state
specStore.set(specAggregate);
}

fetchSpecialtyData();

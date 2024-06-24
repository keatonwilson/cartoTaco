// src/lib/stores.js

// imports
import { writable } from "svelte/store";
import { supabase } from "./supabase";

// combine arrays function to do data merges
function combineArrays(...arrays) {
  const combinedMap = new Map();

  arrays.forEach((array) => {
    array.forEach((item) => {
      if (combinedMap.has(item.est_id)) {
        combinedMap.set(item.est_id, {
          ...combinedMap.get(item.est_id),
          ...item,
        });
      } else {
        combinedMap.set(item.est_id, { ...item });
      }
    });
  });

  return Array.from(combinedMap.values());
}

// export a writable store for core data
export const tacoStore = writable({ combinedSites: [] });

// async fetch data function (currently sites and descriptions)
export async function fetchData() {
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

  // Combine data
  const combinedData = {
    sites: sitesData || [],
    descriptions: descriptionsData || [],
    menu: menuData || [], 
    hours: hoursData || [],
    salsa: salsaData || []
  };

  const aggregate = combineArrays(
    combinedData.sites,
    combinedData.descriptions,
    combinedData.menu,
    combinedData.hours, 
    combinedData.salsa
  );

  // Use the set method of the writable store to update the state
  tacoStore.set(aggregate);
}

fetchData();

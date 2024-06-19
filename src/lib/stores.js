// src/lib/stores.js
import { writable } from 'svelte/store';
import { supabase } from './supabase';

function combineArrays(...arrays) {
  const combinedMap = new Map();

  arrays.forEach(array => {
    array.forEach(item => {
      if (combinedMap.has(item.est_id)) {
        combinedMap.set(item.est_id, { ...combinedMap.get(item.est_id), ...item });
      } else {
        combinedMap.set(item.est_id, { ...item });
      }
    });
  });

  return Array.from(combinedMap.values());
}

export const tacoStore = writable({ combinedSites: [] });

export async function fetchData() {
  // Fetch sites
  let { data: sitesData, error: sitesError } = await supabase.from('sites').select();
  if (sitesError) {
    console.error('Error fetching sites:', sitesError);
    sitesData = [];
  }

  // Fetch descriptions
  let { data: descriptionsData, error: descriptionsError } = await supabase.from('descriptions').select();
  if (descriptionsError) {
    console.error('Error fetching descriptions:', descriptionsError);
    descriptionsData = [];
  }

  // Combine data
  const combinedData = {
    sites: sitesData || [],
    descriptions: descriptionsData || []
  };

  const aggregate = combineArrays(combinedData.sites, combinedData.descriptions);

  // Use the set method of the writable store to update the state
  tacoStore.set(aggregate);
}

fetchData();

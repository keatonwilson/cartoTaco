// src/lib/stores.js
import { writable } from 'svelte/store';
import { supabase } from './supabase';

export const tacoStore = writable({ sites: [], descriptions: [] });

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

  // Use the set method of the writable store to update the state
  tacoStore.set(combinedData);
}

fetchData();

// src/lib/stores.js
import { writable } from 'svelte/store';
import { supabase } from './supabase';

export const locations = writable([]);

export async function fetchLocations() {
  let { data: locations, error } = await supabase.from('locations').select('*');
  if (error) console.error('Error fetching locations:', error);
  else locations.set(locations);
}

fetchLocations();

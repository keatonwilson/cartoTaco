// src/lib/stores.js
import { writable } from 'svelte/store';
import { supabase } from './supabase';

/**
 * @typedef {Object} Location
 * @property {number} id
 * @property {string} name
 * @property {string} address
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} description
 */

/**
 * @type {import('svelte/store').Writable<Location[]>}
 */
export const locations = writable([]);

/**
 * Fetch locations from the database and update the store.
 */
export async function fetchLocations() {
  let { data, error } = await supabase.from('locations').select('*');
  if (error) {
    console.error('Error fetching locations:', error);
  } else {
    // Use the set method of the writable store to update the state
    locations.set(data || []);
  }
}

fetchLocations();

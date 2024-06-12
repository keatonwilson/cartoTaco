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
export const sites = writable([]);

/**
 * Fetch locations from the database and update the store.
 */
export async function fetchSites() {
  let { data, error } = await supabase.from('sites').select();
  if (error) {
    console.error('Error fetching sites:', error);
  } else {
    // Use the set method of the writable store to update the state
    sites.set(data || []);
  }
}

fetchSites();

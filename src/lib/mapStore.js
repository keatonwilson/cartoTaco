// src/lib/mapStore.js
// Stores reference to the Mapbox instance so other components can interact with it

import { writable } from 'svelte/store';

export const mapInstance = writable(null);

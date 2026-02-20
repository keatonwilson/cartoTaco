// src/lib/newSpotsStore.js
// Manages "seen" state for recently added establishments

import { writable, derived } from 'svelte/store';
import { recentlyAddedSites } from './stores';
import { browser } from '$app/environment';

const STORAGE_KEY = 'cartoTaco_lastSeenNewSpotsTime';

// Store for tracking when user last saw new spots
export const lastSeenNewSpotsTime = writable(null);

// Initialize from localStorage on startup
if (browser) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    lastSeenNewSpotsTime.set(new Date(stored));
  }
}

// Derived store: count of unseen recently added sites
export const unseenNewSpotsCount = derived(
  [recentlyAddedSites, lastSeenNewSpotsTime],
  ([$recentlyAddedSites, $lastSeenNewSpotsTime]) => {
    if (!$recentlyAddedSites || $recentlyAddedSites.length === 0) {
      return 0;
    }

    if (!$lastSeenNewSpotsTime) {
      // User has never marked as seen, so all are unseen
      return $recentlyAddedSites.length;
    }

    // Count sites added after the last seen time
    return $recentlyAddedSites.filter(site => {
      const createdDate = new Date(site.createdAt);
      return createdDate > $lastSeenNewSpotsTime;
    }).length;
  }
);

// Mark all new spots as seen
export function markNewSpotsAsSeen() {
  const now = new Date();
  lastSeenNewSpotsTime.set(now);

  if (browser) {
    localStorage.setItem(STORAGE_KEY, now.toISOString());
  }
}

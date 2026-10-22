import { writable } from 'svelte/store';

// Whether the FilterBar's filter panel is expanded
export const filterPanelOpen = writable(false);

// Whether the mobile navigation menu is open
export const mobileNavOpen = writable(false);

// Peek card for the pin under the cursor (or tapped, on touch tablets):
// { site, lngLat: [lng, lat] } | null. Set by mapping.js, drawn by PeekCard.svelte.
export const peekSite = writable(null);

// Whether the QuickSearch palette (⌘K or /) is open
export const quickSearchOpen = writable(false);

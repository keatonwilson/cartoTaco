import { writable } from 'svelte/store';

// Whether the FilterBar's filter panel is expanded
export const filterPanelOpen = writable(false);

// Whether the mobile navigation menu is open
export const mobileNavOpen = writable(false);

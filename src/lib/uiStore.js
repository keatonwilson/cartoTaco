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

// Whether the concierge chat panel is open (ChatPanel.svelte), and its docked
// width on desktop/tablet (the map pads by it; the filter bar and map controls
// move left by it via --chat-panel-offset)
export const chatOpen = writable(false);
export const CHAT_PANEL_WIDTH = 380;

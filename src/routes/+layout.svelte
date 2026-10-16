<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { initTheme } from '$lib/theme.js';
	import { loadFavorites } from '$lib/favoritesStore.js';
	import { loadUserVibeVotes } from '$lib/vibeVotesStore.js';
	import { isAuthenticated } from '$lib/authStore.js';
	import { initializeStores } from '$lib/stores.js';
	import '../app.css';
	import Header from '$lib/../components/Header.svelte';
	import TourOverlay from '$lib/../components/TourOverlay.svelte';
	import ToastHost from '$lib/../components/ToastHost.svelte';
	import { shouldAutoStart, startTour } from '$lib/tourStore.js';

	$: isMapPage = $page.url.pathname === '/';

	onMount(() => {
		// Initialize data stores
		initializeStores();

		// Initialize theme system (returns cleanup function)
		const cleanupTheme = initTheme();

		// Load user-scoped social data if authenticated
		if ($isAuthenticated) {
			loadFavorites();
			loadUserVibeVotes();
		}

		// Cleanup on unmount
		return () => {
			if (cleanupTheme) cleanupTheme();
			clearTimeout(tourTimeout);
		};
	});

	// Auto-start tour for first-time visitors, but only on the map: its steps
	// point at map-page controls, and a first visit can land on /reset-password
	// or /auth/confirm from an email (delay to let map render)
	let tourTimeout = null;
	let tourAutoStarted = false;
	$: if (isMapPage && !tourAutoStarted && !tourTimeout && shouldAutoStart()) {
		tourTimeout = setTimeout(() => {
			tourAutoStarted = true;
			tourTimeout = null;
			startTour();
		}, 1500);
	}
	$: if (!isMapPage && tourTimeout) {
		clearTimeout(tourTimeout);
		tourTimeout = null;
	}

	// Reload user-scoped social data when authentication state changes
	$: if ($isAuthenticated) {
		loadFavorites();
		loadUserVibeVotes();
	}
</script>

<div class="app">
  <Header />
  <TourOverlay />
  <ToastHost />
  <main class:map-page={isMapPage}>
    <slot></slot>
  </main>
</div>

<style>
  .app {
    position: relative;
    /* dvh, not vh: on mobile Safari/Chrome 100vh is the *large* viewport
       (address bar hidden), so a 100vh shell is taller than the visible
       scrollport and the page scrolls even when nothing overflows. That scroll
       used to slide the map overlays up under the sticky header. */
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
  }

  /* Map page needs absolute positioning to render behind the transparent header */
  main.map-page {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
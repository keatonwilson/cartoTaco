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

		// Auto-start tour for first-time visitors (delay to let map render)
		if (shouldAutoStart()) {
			const tourTimeout = setTimeout(() => startTour(), 1500);
			return () => {
				if (cleanupTheme) cleanupTheme();
				clearTimeout(tourTimeout);
			};
		}

		// Cleanup on unmount
		return () => {
			if (cleanupTheme) cleanupTheme();
		};
	});

	// Reload user-scoped social data when authentication state changes
	$: if ($isAuthenticated) {
		loadFavorites();
		loadUserVibeVotes();
	}
</script>

<div class="app">
  <Header />
  <TourOverlay />
  <main class:map-page={isMapPage}>
    <slot></slot>
  </main>
</div>

<style>
  .app {
    position: relative;
    min-height: 100vh;
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
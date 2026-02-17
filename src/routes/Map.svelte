<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import {
		tacoStore,
		summaryStore,
		specStore,
		isLoading,
		hasError,
		processedTacoData,
		filteredTacoData,
		summaryStats
	} from '../lib/stores';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { updateMarkers, resetListeners } from '../lib/mapping.js';
	import FilterBar from '../components/FilterBar.svelte';
	import { effectiveTheme, getMapboxStyle } from '$lib/theme.js';

	let map;
	let mapContainer;
	let mapLoaded = false; // Track if map has completed initial load
	let lastDataLength = -1; // Track the last data length to avoid unnecessary updates
	let currentTheme = null; // Track current theme to prevent duplicate style changes

	mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

	onMount(() => {
		if (!mapContainer) return;

		// Initialize the map with theme-appropriate style
		map = new mapboxgl.Map({
			container: mapContainer,
			style: getMapboxStyle($effectiveTheme),
			center: [-110.97, 32.16],
			zoom: 9
		});

		// Add zoom and rotation controls to the map
		const navControl = new mapboxgl.NavigationControl();
		map.addControl(navControl, 'top-right');

		// Add geolocation control to the map
		const geoLocateControl = new mapboxgl.GeolocateControl({
			positionOptions: {
				enableHighAccuracy: true
			},
			trackUserLocation: true,
			showAccuracyCircle: true
		});
		map.addControl(geoLocateControl, 'top-right');

		// Wait for map to fully load before adding markers
		map.on('load', () => {
			currentTheme = $effectiveTheme; // Set initial theme to prevent reactive trigger
			mapLoaded = true; // Mark map as loaded
			// Trigger the reactive statement to add markers
			if ($filteredTacoData && $filteredTacoData.length > 0) {
				updateMarkers($filteredTacoData, map);
			}
		});

		// Cleanup map on component unmount
		return () => {
			resetListeners(map); // Remove event listeners before destroying map
			if (map) map.remove();
		};
	});

	// Update markers when filtered data changes
	// Note: With clustering, we don't need a markers array - Mapbox manages it internally
	$: if (map && map.loaded() && $filteredTacoData && !$isLoading) {
		if ($filteredTacoData.length !== lastDataLength) {
			lastDataLength = $filteredTacoData.length;
			updateMarkers($filteredTacoData, map);
		}
	}

	// Update map style when theme changes (only after initial load)
	$: if (map && mapLoaded && $effectiveTheme && $effectiveTheme !== currentTheme) {
		const newStyle = getMapboxStyle($effectiveTheme);

		// Check if we need to change the style
		try {
			const currentStyle = map.getStyle();
			const isDarkStyle = currentStyle && currentStyle.sprite && currentStyle.sprite.includes('dark');
			const shouldBeDark = $effectiveTheme === 'dark';

			// Only change if there's a mismatch
			if (isDarkStyle !== shouldBeDark) {
				// Update current theme BEFORE changing style to prevent re-triggering
				currentTheme = $effectiveTheme;

				// Store current center and zoom to preserve view
				const center = map.getCenter();
				const zoom = map.getZoom();

				// Remove existing listeners since setStyle removes all layers
				resetListeners(map);

				// Update map style
				map.setStyle(newStyle);

				// Wait for style to load, then re-add markers
				map.once('style.load', () => {
					// Restore center and zoom
					map.setCenter(center);
					map.setZoom(zoom);

					// Wait for map to be idle before adding markers
					map.once('idle', () => {
						if ($filteredTacoData && $filteredTacoData.length > 0) {
							updateMarkers($filteredTacoData, map);
						}
					});
				});
			} else {
				currentTheme = $effectiveTheme;
			}
		} catch {
			// Style not ready yet, will be handled on next reactive trigger
		}
	}

	// Function to retry data loading on error
	async function retryLoading() {
		const { fetchSiteData, fetchSummaryData, fetchSpecialtyData } = await import('../lib/stores');
		if ($tacoStore.error) fetchSiteData();
		if ($summaryStore.error) fetchSummaryData();
		if ($specStore.error) fetchSpecialtyData();
	}
</script>

<!-- Map wrapper: keeps Mapbox container separate from Svelte-managed overlays -->
<div class="map-wrapper">
	<div bind:this={mapContainer} id="map"></div>

	{#if $isLoading}
		<div class="loading-container">
			<div class="loading-spinner"></div>
			<p>Loading taco data...</p>
		</div>
	{/if}

	{#if $hasError}
		<div class="error-container">
			<h3>Error loading data</h3>
			<p>We couldn't load the taco map data. Please try again.</p>
			<button on:click={retryLoading} class="retry-button">Retry</button>
		</div>
	{/if}
</div>

<!-- Filter Bar -->
{#if !$isLoading && !$hasError}
	<FilterBar />
{/if}

<style>
  .map-wrapper {
    width: 100%;
    height: 100vh;
    position: relative;
  }

  #map {
    width: 100%;
    height: 100%;
  }

  /* Position map controls below the transparent header */
  :global(.mapboxgl-ctrl-top-right) {
    top: 76px !important;
  }

  /* Mobile-first responsive popup styles */
  :global(.mapboxgl-popup) {
    /* Mobile: Nearly full width with breathing room */
    width: calc(100vw - 20px) !important;
    max-width: calc(100vw - 20px) !important;
  }

  /* Tablet: 90vw centered, max 700px */
  @media (min-width: 768px) {
    :global(.mapboxgl-popup) {
      width: 90vw !important;
      max-width: 700px !important;
    }
  }

  /* Desktop: Fixed 800px as before */
  @media (min-width: 1024px) {
    :global(.mapboxgl-popup) {
      width: 800px !important;
      max-width: 800px !important;
    }
  }

  :global(.mapboxgl-popup-content) {
    padding: 10px;
    font-size: 14px;
    border-radius: 2%;
    opacity: 0.95;
    /* Mobile: Constrain height and enable scrolling */
    max-height: 80vh;
    overflow-y: auto;
    background: white;
  }

  :global(.dark) :global(.mapboxgl-popup-content) {
    background: #1f2937;
  }

  /* Desktop: Allow more height */
  @media (min-width: 1024px) {
    :global(.mapboxgl-popup-content) {
      max-height: 90vh;
    }
  }

  :global(.mapboxgl-popup-tip) {
    border-width: 10px;
  }

  /* Improved close button styling */
  :global(.mapboxgl-popup-close-button) {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #e0e0e0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    font-size: 20px;
    font-weight: 600;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 1000;
    padding: 0 0 2px 0; /* Shift × up slightly */
    line-height: 0; /* Better vertical centering */
  }

  :global(.dark) :global(.mapboxgl-popup-close-button) {
    background: rgba(31, 41, 55, 0.95);
    border-color: #4b5563;
    color: #9ca3af;
  }

  :global(.mapboxgl-popup-close-button):hover {
    background: #fff;
    border-color: #FE795D;
    color: #FE795D;
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  }

  :global(.mapboxgl-popup-close-button):active {
    transform: scale(0.95);
  }

  /* Mobile: Larger touch target */
  @media (max-width: 768px) {
    :global(.mapboxgl-popup-close-button) {
      width: 36px;
      height: 36px;
      right: 6px;
      top: 6px;
      font-size: 22px;
    }
  }
  
  .loading-container, .error-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    text-align: center;
    z-index: 10;
  }
  
  .loading-spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px auto;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .retry-button {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 8px 16px;
    margin-top: 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  
	.retry-button:hover {
		background-color: #45a049;
	}
</style>

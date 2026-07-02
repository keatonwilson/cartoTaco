<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import {
		tacoStore,
		isLoading,
		hasError,
		processedTacoData,
		filteredTacoData,
		selectedSite,
		flyToTarget
	} from '../lib/stores';
	import { isMobile, screenWidth } from '../lib/deviceDetection';
	import Card from '../components/Card.svelte';
	import { filterPanelOpen, mobileNavOpen } from '../lib/uiStore.js';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { updateMarkers, resetListeners, updateTrailLayers, updateTrailRoute, clearTrailLayers, flyToSite, applyLens } from '../lib/mapping.js';
	import { mapInstance } from '../lib/mapStore.js';
	import { mapLens } from '../lib/mapLensStore.js';
	import FilterBar from '../components/FilterBar.svelte';
	import MapLensPicker from '../components/MapLensPicker.svelte';
	import TrailTray from '../components/TrailTray.svelte';
	import ComparisonTray from '../components/ComparisonTray.svelte';
	import { comparisonActive, addToComparison } from '../lib/comparisonStore.js';
	import { effectiveTheme, getMapboxStyle } from '$lib/theme.js';
	import {
		trailModeActive,
		trailStops,
		trailRoute,
		trailTransportMode,
		enterTrailMode,
		addStop
	} from '../lib/trailStore.js';

	let map;
	let mapContainer;
	let mapLoaded = false; // Track if map has completed initial load
	let lastDataKey = ''; // Track the last set of site IDs to detect filter swaps (same length, different sites)
	let currentTheme = null; // Track current theme to prevent duplicate style changes
	let trailRestored = false; // Prevent re-running URL trail reconstruction
	let comparisonRestored = false; // Prevent re-running URL comparison reconstruction

	// Mobile bottom sheet state
	let sheetEl;
	let sheetContentEl;
	let touchStartY = 0;
	let isDragging = false;

	function handleSheetTouchStart(e) {
		touchStartY = e.touches[0].clientY;
		isDragging = true;
	}

	function handleSheetTouchMove(e) {
		if (!isDragging || !sheetEl) return;
		e.preventDefault(); // Prevent pull-to-refresh while dragging handle
		const deltaY = e.touches[0].clientY - touchStartY;
		if (deltaY > 0) {
			// Preserve Z so the outer sheet keeps its GPU compositing layer during drag
			sheetEl.style.transform = `translateY(${deltaY}px) translateZ(0)`;
		}
	}

	function handleSheetTouchEnd(e) {
		if (!isDragging) return;
		isDragging = false;
		const deltaY = e.changedTouches[0].clientY - touchStartY;
		if (deltaY > 100) {
			// Swiped down far enough — dismiss
			selectedSite.set(null);
		} else if (sheetEl) {
			// Snap back — animate to resting Z position, then clear inline style
			sheetEl.style.transition = 'transform 0.25s ease';
			sheetEl.style.transform = 'translateZ(0)';
			setTimeout(() => {
				if (sheetEl) {
					sheetEl.style.transition = '';
					sheetEl.style.transform = ''; // falls back to CSS class translateZ(0)
				}
			}, 250);
		}
	}

	function closeSheet() {
		selectedSite.set(null);
	}

	// When the bottom sheet opens, collapse the filter panel and mobile nav
	$: if ($isMobile && $selectedSite) {
		filterPanelOpen.set(false);
		mobileNavOpen.set(false);
	}

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

		// Expose map instance to other components (e.g., NewSpotsBadge)
		mapInstance.set(map);

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
		const dataKey = $filteredTacoData.map(s => s.est_id).join(',');
		if (dataKey !== lastDataKey) {
			lastDataKey = dataKey;
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
						// Re-add trail layers if trail mode is active
						if ($trailModeActive) {
							updateTrailLayers(map, $trailStops);
							updateTrailRoute(map, $trailRoute);
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

	// Switch marker styling when the map lens changes
	$: if (map && mapLoaded && $mapLens) applyLens(map, $mapLens);

	// Re-draw numbered stop markers when trail stops change (only while trail mode is active)
	$: if (map && mapLoaded && $trailModeActive) updateTrailLayers(map, $trailStops);

	// Re-draw route line when route GeoJSON changes (only while trail mode is active)
	$: if (map && mapLoaded && $trailModeActive) updateTrailRoute(map, $trailRoute);

	// When trail mode exits, explicitly remove all trail layers and sources from the map
	$: if (map && mapLoaded && !$trailModeActive) clearTrailLayers(map);

	// Map padding: account for mobile sheet and trail tray.
	// $screenWidth is referenced so this re-runs on resize/rotation, keeping
	// the padding in sync with the landscape-aware sheet height.
	$: if (map && mapLoaded) {
		const landscape = $screenWidth > 0 && typeof window !== 'undefined'
			&& window.innerWidth > window.innerHeight && window.innerHeight < 500;
		let bottomPadding = 0;
		if ($isMobile && $selectedSite) {
			bottomPadding = typeof window !== 'undefined'
				? Math.round(window.innerHeight * (landscape ? 0.45 : 0.65))
				: 300;
		} else if ($trailModeActive) {
			bottomPadding = 280;
		} else if ($comparisonActive) {
			bottomPadding = 160;
		}
		map.setPadding({ bottom: bottomPadding });
	}

	// Reconstruct trail from URL params once processedTacoData is available
	$: if (!trailRestored && $processedTacoData && $processedTacoData.length > 0 && typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		const trailParam = params.get('trail');
		trailRestored = true;
		if (trailParam) {
			const ids = trailParam.split(',').map(Number);
			const modeParam = params.get('mode');
			if (modeParam === 'drive') {
				trailTransportMode.set('driving');
			}
			const sites = ids.map((id) => $processedTacoData.find((s) => s.est_id === id)).filter(Boolean);
			if (sites.length > 0) {
				sites.forEach((site) => addStop(site));
				enterTrailMode();
			}
		}
	}

	// Navigate to a specific location from URL ?location= param (used by favorites + taste profile)
	let locationRestored = false;
	$: if (!locationRestored && mapLoaded && $processedTacoData && $processedTacoData.length > 0 && typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		const locationParam = params.get('location');
		locationRestored = true;
		if (locationParam) {
			const site = $processedTacoData.find((s) => s.est_id === Number(locationParam));
			if (site && map) {
				selectedSite.set(site);
				flyToSite(map, site);
				// Clean up the URL param without navigating
				const newParams = new URLSearchParams(window.location.search);
				newParams.delete('location');
				const newUrl = newParams.toString() ? `?${newParams}` : window.location.pathname;
				history.replaceState({}, '', newUrl);
			}
		}
	}

	// Handle Surprise Me fly-to requests from FilterBar
	$: if (map && mapLoaded && $flyToTarget) {
		flyToSite(map, $flyToTarget);
		flyToTarget.set(null);
	}

	// Reconstruct comparison from URL params once processedTacoData is available
	$: if (!comparisonRestored && $processedTacoData && $processedTacoData.length > 0 && typeof window !== 'undefined') {
		const params = new URLSearchParams(window.location.search);
		const compareParam = params.get('compare');
		comparisonRestored = true;
		if (compareParam) {
			const ids = compareParam.split(',').map(Number);
			const sites = ids.map((id) => $processedTacoData.find((s) => s.est_id === id)).filter(Boolean);
			sites.forEach((site) => addToComparison(site));
		}
	}

	// Function to retry data loading on error
	async function retryLoading() {
		const { fetchSiteData } = await import('../lib/stores');
		if ($tacoStore.error) fetchSiteData();
	}
</script>

<!-- Map wrapper: keeps Mapbox container separate from Svelte-managed overlays -->
<div class="map-wrapper">
	<div bind:this={mapContainer} id="map" data-tour="map"></div>

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

<!-- Filter Bar + Lens Picker + Trail Tray + Comparison Tray -->
{#if !$isLoading && !$hasError}
	<FilterBar />
	<MapLensPicker />
	<TrailTray />
	<ComparisonTray cardOpen={$isMobile && !!$selectedSite} />
{/if}

<!-- Mobile Bottom Sheet: replaces Mapbox popup on small screens -->
{#if $isMobile && $selectedSite}
	<div class="mobile-sheet" bind:this={sheetEl}>
		<!-- Drag handle bar — touch here to swipe-dismiss -->
		<div
			class="sheet-handle-bar"
			role="button"
			tabindex="0"
			aria-label="Drag down to close"
			on:touchstart={handleSheetTouchStart}
			on:touchmove={handleSheetTouchMove}
			on:touchend={handleSheetTouchEnd}
		>
			<!-- Spacer mirrors the close button width to keep the pill truly centered -->
			<div class="sheet-handle-spacer"></div>
			<div class="sheet-handle"></div>
			<button class="sheet-close-btn" on:click={closeSheet} aria-label="Close panel">
				×
			</button>
		</div>
		<!-- Scrollable card content -->
		<div class="sheet-content" bind:this={sheetContentEl}>
			<Card />
		</div>
	</div>
{/if}

<style>
  .map-wrapper {
    width: 100%;
    /* dvh = dynamic viewport height: excludes the iOS Safari address bar,
       preventing the map from overflowing under it. Falls back to vh. */
    height: 100dvh;
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

  /* ===== Mobile Bottom Sheet ===== */
  .mobile-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 65dvh; /* dvh excludes iOS Safari address bar */
    background: white;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.18);
    z-index: 150;
    display: flex;
    flex-direction: column;
    /* Keep sheet on its own GPU compositing layer at all times.
       Without this, iOS Safari uses a CPU paint path after the slide-in
       animation ends, which fails to repaint text-color changes (e.g. the
       compare button going white-on-orange) until a scroll/transform event
       forces a GPU flush. translateZ(0) keeps the GPU layer active. */
    transform: translateZ(0);
    /* Slide in from bottom */
    animation: sheet-slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  }

  /* In landscape on a phone the sheet is shallower so the map stays usable */
  @media (orientation: landscape) and (max-height: 500px) {
    .mobile-sheet {
      height: 45dvh;
    }
  }

  :global(.dark) .mobile-sheet {
    background: #1f2937;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  }

  @keyframes sheet-slide-up {
    from { transform: translateY(100%); }
    to   { transform: translateZ(0); } /* matches resting CSS — no jump on animation end */
  }

  /* Handle bar — the draggable zone at the top of the sheet.
     3-column flex: [spacer] [pill] [close btn]
     The spacer mirrors the button width so the pill stays truly centred. */
  .sheet-handle-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 10px;
    touch-action: none;
    cursor: grab;
  }

  /* Balances the close button so the handle pill sits in the exact centre */
  .sheet-handle-spacer {
    width: 30px;
    flex-shrink: 0;
  }

  /* Visual pill handle */
  .sheet-handle {
    width: 40px;
    height: 4px;
    background: #d1d5db;
    border-radius: 2px;
    pointer-events: none;
  }

  :global(.dark) .sheet-handle {
    background: #4b5563;
  }

  /* Close (×) button */
  .sheet-close-btn {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    font-size: 20px;
    line-height: 1;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0 0 1px 0;
  }

  .sheet-close-btn:hover {
    background: #fff;
    border-color: #FE795D;
    color: #FE795D;
  }

  :global(.dark) .sheet-close-btn {
    background: #374151;
    border-color: #4b5563;
    color: #9ca3af;
  }

  :global(.dark) .sheet-close-btn:hover {
    border-color: #FE795D;
    color: #FE795D;
  }

  /* Scrollable content inside the sheet */
  .sheet-content {
    flex: 1;
    overflow-y: auto;
    /* Prevent scroll from propagating to the map at top/bottom boundaries */
    overscroll-behavior: contain;
    /* Bottom padding accounts for the home-indicator bar on iPhone X+ */
    padding: 0 10px max(20px, env(safe-area-inset-bottom));
    /* iOS Safari: force this scroll container onto its own persistent GPU
       compositing layer. Without this, iOS caches the scroll layer as a
       stale texture and won't repaint text-color changes (e.g. compare
       button white text on orange) until a scroll event forces a flush. */
    transform: translateZ(0);
  }
</style>

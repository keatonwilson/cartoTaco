<script>
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
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
	import PendingSpotCard from '../components/PendingSpotCard.svelte';
	import SpotPanel from '../components/SpotPanel.svelte';
	import PeekCard from '../components/PeekCard.svelte';
	import MapLegend from '../components/MapLegend.svelte';
	import { filterPanelOpen, mobileNavOpen, peekSite } from '../lib/uiStore.js';
	import { tourActive } from '../lib/tourStore.js';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import {
		updateMarkers,
		resetListeners,
		updateTrailLayers,
		updateTrailRoute,
		clearTrailLayers,
		flyToSite,
		applyLens,
		closeSpot,
		syncMapPadding,
		spotPanelWidth
	} from '../lib/mapping.js';
	import { mapInstance } from '../lib/mapStore.js';
	import { mapLens } from '../lib/mapLensStore.js';
	import FilterBar from '../components/FilterBar.svelte';
	import LoadingState from '../components/LoadingState.svelte';
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

		// Pick up any padding change that landed while the camera was moving
		map.on('moveend', () => syncMapPadding(map));

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

	// Map padding: room for the mobile sheet, the desktop spot panel, or an open
	// trail/comparison tray (computeMapPadding in mapping.js). The stores are
	// referenced so this re-runs when any of them, or the window size, changes.
	$: if (map && mapLoaded) {
		void [$isMobile, $selectedSite, $trailModeActive, $comparisonActive, $screenWidth];
		syncMapPadding(map);
	}

	// ── Desktop/tablet spot panel ──
	$: panelOpen = !$isMobile && !!$selectedSite;
	$: panelWidth = spotPanelWidth($screenWidth);

	// The legend and the bottom trays start beside the panel instead of under it
	$: if (typeof document !== 'undefined') {
		document.documentElement.style.setProperty('--spot-panel-offset', panelOpen ? `${panelWidth}px` : '0px');
	}
	onDestroy(() => {
		if (typeof document !== 'undefined') document.documentElement.style.removeProperty('--spot-panel-offset');
	});

	function closeOpenSpot() {
		closeSpot(map);
	}

	// Esc steps back: peek first, then the open spot. Left alone while typing
	// or during the tour, which has its own keys.
	function handleKeydown(e) {
		if (e.key !== 'Escape' || $tourActive) return;
		const t = e.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if ($peekSite) {
			peekSite.set(null);
		} else if ($selectedSite) {
			closeOpenSpot();
		}
	}

	// ── The open spot lives in the URL (?location=<id>) ──
	// Opening a spot adds one history entry; switching spots replaces it, so a
	// single Back always leaves the spot, however many pins you clicked. The
	// link is shareable, and the same param is what /salsa and favorites link to.
	let urlSpotId = null; // the spot the current history entry describes
	let pushedSpotEntry = false; // whether that entry is one we pushed

	function spotUrl(id) {
		const url = new URL(window.location.href);
		if (id === null) url.searchParams.delete('location');
		else url.searchParams.set('location', String(id));
		return url.pathname + url.search + url.hash;
	}

	$: syncSpotUrl($selectedSite?.est_id ?? null);
	function syncSpotUrl(id) {
		if (typeof window === 'undefined' || id === urlSpotId) return;
		const previous = urlSpotId;
		urlSpotId = id;
		try {
			if (id !== null && previous === null) {
				pushState(spotUrl(id), { spotId: id });
				pushedSpotEntry = true;
			} else if (id !== null) {
				replaceState(spotUrl(id), { spotId: id });
			} else if (pushedSpotEntry) {
				// Closing from the page (×, Esc, empty map): step back off our entry
				pushedSpotEntry = false;
				history.back();
			} else {
				replaceState(spotUrl(null), {});
			}
		} catch {
			// Router not ready yet; the URL just won't track this one
		}
	}

	// Back/Forward. Acts only when the entry's spot actually changes: $page can
	// re-emit with the previous entry's state while a Back is landing, which
	// would otherwise reopen the spot we just closed.
	let lastHistorySpotId = null;
	$: onSpotHistory($page.state?.spotId ?? null);
	function onSpotHistory(id) {
		if (typeof window === 'undefined' || id === lastHistorySpotId) return;
		lastHistorySpotId = id;
		if (id === urlSpotId) return;
		urlSpotId = id;
		if (id === null) {
			pushedSpotEntry = false;
			closeSpot(map);
			return;
		}
		pushedSpotEntry = true;
		const site = $processedTacoData.find((s) => s.est_id === id);
		if (site && map) flyToSite(map, site);
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
			} else if (modeParam === 'bike') {
				trailTransportMode.set('cycling');
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
				// The link's own entry describes this spot, so closing it later
				// rewrites the URL rather than stepping Back out of the app
				urlSpotId = site.est_id;
				pushedSpotEntry = false;
				try {
					replaceState(spotUrl(site.est_id), { spotId: site.est_id });
				} catch {}
				flyToSite(map, site);
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

<svelte:window on:keydown={handleKeydown} />

<!-- Map wrapper: keeps Mapbox container separate from Svelte-managed overlays -->
<div class="map-wrapper">
	<div bind:this={mapContainer} id="map" data-tour="map"></div>

	{#if mapLoaded}
		<PeekCard {map} />
	{/if}

	{#if $isLoading}
		<div class="loading-container">
			<LoadingState message="Mapping Tucson's tacos…" />
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

<!-- Filter Bar (with attached lens strip) + Trail Tray + Comparison Tray -->
{#if !$isLoading && !$hasError}
	<FilterBar />
	<TrailTray />
	<ComparisonTray cardOpen={$isMobile && !!$selectedSite} />
	<MapLegend />
{/if}

<!-- Desktop/tablet: the spot panel docked on the left -->
{#if panelOpen}
	<SpotPanel width={panelWidth} on:close={closeOpenSpot} />
{/if}

<!-- Mobile Bottom Sheet -->
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
		<!-- Scrollable card content: pending spots get the lightweight preliminary card -->
		<div class="sheet-content" bind:this={sheetContentEl}>
			{#if $selectedSite.isPending}
				<PendingSpotCard />
			{:else}
				<Card />
			{/if}
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
    top: calc(var(--header-h) + 10px) !important;
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

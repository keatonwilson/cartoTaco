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
  import { updateMarkers } from "../lib/mapping.js";
  import FilterBar from '../components/FilterBar.svelte';

  let map;
  let mapContainer;

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

  onMount(() => {
    if (!mapContainer) return;

    // Clear any residual content in the map container
    mapContainer.innerHTML = '';

    // Initialize the map
    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/standard',
      center: [-110.97, 32.16],
      zoom: 9,
    });

    // Add zoom and rotation controls to the map.
    const navControl = new mapboxgl.NavigationControl();
    map.addControl(navControl, 'top-right');

    // Add geolocation control to the map.
    const geoLocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showAccuracyCircle: true
    });
    map.addControl(geoLocateControl, 'top-right');

    // Cleanup map on component unmount
    return () => {
      if (map) map.remove();
    };
  });

  // Update markers when filtered data changes
  // Note: With clustering, we don't need a markers array - Mapbox manages it internally
  $: if (map && $filteredTacoData.length >= 0 && !$isLoading) {
    updateMarkers($filteredTacoData, map, null, $summaryStats);
  }

  // Function to retry data loading on error
  function retryLoading() {
    const fetchFunctions = [];
    
    if ($tacoStore.error) {
      import('../lib/stores').then(module => {
        module.fetchSiteData();
      });
    }
    
    if ($summaryStore.error) {
      import('../lib/stores').then(module => {
        module.fetchSummaryData();
      });
    }
    
    if ($specStore.error) {
      import('../lib/stores').then(module => {
        module.fetchSpecialtyData();
      });
    }
  }
</script>

<!-- Map Container with loading and error states -->
<div bind:this={mapContainer} id="map">
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

<!-- Logo Element outside of the map container -->
<img id="logo" src="/color_light_bg.png" alt="Logo">

<!-- Filter Bar -->
{#if !$isLoading && !$hasError}
  <FilterBar />
{/if}

<style>
  #map {
    width: 100%;
    height: 100vh;
    position: relative;
  }

  #logo {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 250px;
    height: auto;
    z-index: 1;
  }

  /* Mobile: Smaller logo positioned below FilterBar */
  @media (max-width: 768px) {
    #logo {
      top: 80px; /* Position below FilterBar with margin */
      left: 10px;
      width: 140px; /* Smaller on mobile */
      z-index: 5; /* Higher than map controls but below FilterBar */
    }
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

<script>
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { tacoStore, summaryStore, specStore, isLoading, hasError } from '../lib/stores';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { updateMarkers } from "../lib/mapping.js";

  let map;
  let markers = [];
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

  // Only update markers when all data is loaded and the map is initialized
  $: if (map && $tacoStore.data && $summaryStore.data && $specStore.data && !$isLoading) {
    updateMarkers($tacoStore.data, map, markers, $summaryStore.data, $specStore.data);
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
    width: 250px; /* Adjust the width as needed */
    height: auto;
    z-index: 1;
  }

  :global(.mapboxgl-popup) {
    width: 800px !important;
    max-width: none !important;
  }

  :global(.mapboxgl-popup-content) {
    padding: 10px;
    font-size: 14px;
    border-radius: 2%;
    opacity: 0.95;
  }

  :global(.mapboxgl-popup-tip) {
    border-width: 10px;
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

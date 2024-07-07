<script>
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { tacoStore, summaryStore } from '../lib/stores';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { updateMarkers } from "../lib/mapping.js";

  let map;
  let markers = [];

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

  onMount(() => {
    const mapContainer = document.getElementById('map');

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

    // Update markers
    updateMarkers($tacoStore, map, markers, $summaryStore);

    // Cleanup map on component unmount
    return () => map.remove();
  });

  $: {
    updateMarkers($tacoStore, map, markers, $summaryStore);
  }
</script>

<!-- Map Container -->
<div id="map"></div>

<!-- Logo Element outside of the map container -->
<img id="logo" src="/color_light_bg.png" alt="Logo">

<style>
  #map {
    width: 100%;
    height: 100vh;
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
</style>

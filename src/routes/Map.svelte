<script>
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { tacoStore } from '../lib/stores';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { updateMarkers } from "../lib/mapping.js";

  let map;
  let markers = [];

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

  onMount(() => {
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/standard',
      center: [-110.97, 32.16],
      zoom: 9,
    });

    updateMarkers($tacoStore, map, markers);

    return () => map.remove();
  });

  $: {
    updateMarkers($tacoStore, map, markers);
  }
</script>

<div id="map"></div>
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

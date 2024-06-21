<script>
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { tacoStore } from '../lib/stores';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import { updateMarkers } from "../lib/mapping.js"
  
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

<style>
  #map {
    width: 100%;
    height: 100vh;
  }

  :global(.mapboxgl-popup) {
    width: 800px !important;
    max-width: none !important;
  }

  :global(.mapboxgl-popup-content) {
    padding: 20px;
    font-size: 14px;
  }

  :global(.mapboxgl-popup-tip) {
    border-width: 10px;
  }
</style>

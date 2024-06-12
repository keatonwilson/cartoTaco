<!-- src/routes/Map.svelte -->
<script>
    import { onMount } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import { sites } from '../lib/stores';
    import { get } from 'svelte/store';
  
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;
  
    /**
   * @type {{ remove: () => any; }}
   */
    let map;
  
    onMount(() => {
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-110.97, 32.16],
        zoom: 9
      });
      return () => map.remove();
    });
  
    $: {
      /**
       * @type {any[]}
       */
      const currentSites = $sites;
      if (map && currentSites) {
        currentSites.forEach(site => {
          new mapboxgl.Marker()
            .setLngLat([site.lon_1, site.lat_1])
            .setPopup(new mapboxgl.Popup().setHTML(`<h3>${site.name}</h3><p>${site.description}</p>`))
            .addTo(map);
        });
      }
    }
  </script>
  
  <style>
    #map {
      width: 100%;
      height: 100vh;
    }
  </style>
  
  <div id="map"></div>
  
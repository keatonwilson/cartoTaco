<!-- src/routes/Map.svelte -->
<script>
    import { onMount } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import { locations } from '../lib/stores';
    import { get } from 'svelte/store';
  
    mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';
  
    let map;
  
    onMount(() => {
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-74.5, 40],
        zoom: 9
      });
  
      const currentLocations = get(locations);
      currentLocations.forEach(location => {
        new mapboxgl.Marker()
          .setLngLat([location.longitude, location.latitude])
          .setPopup(new mapboxgl.Popup().setHTML(`<h3>${location.name}</h3><p>${location.description}</p>`))
          .addTo(map);
      });
  
      return () => map.remove();
    });
  
    $: {
      const currentLocations = get(locations);
      if (map && currentLocations) {
        currentLocations.forEach(location => {
          new mapboxgl.Marker()
            .setLngLat([location.longitude, location.latitude])
            .setPopup(new mapboxgl.Popup().setHTML(`<h3>${location.name}</h3><p>${location.description}</p>`))
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
  
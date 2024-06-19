<script>
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { tacoStore } from '../lib/stores';
  import 'mapbox-gl/dist/mapbox-gl.css';
  import PopupContent from '../components/Card.svelte';
  import { activePopup } from '../lib/stores';

  let map;
  let markers = [];

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

  const updateMarkers = (currentSites) => {
    if (!Array.isArray(currentSites)) {
      currentSites = [];
    }
    markers.forEach((marker) => marker.remove());
    markers = [];
    if (map && currentSites) {
      currentSites.forEach((site) => {
        const marker = new mapboxgl.Marker()
          .setLngLat([site.lon_1, site.lat_1])
          .setPopup(
            new mapboxgl.Popup().setDOMContent(
              createPopupContent({
                name: site.name,
                type: site.type,
                shortDescription: site.short_descrip,
                longDescription: site.long_descrip,
              })
            )
          )
          .addTo(map);

        markers.push(marker);
      });
    }
  };

  function createPopupContent(data) {
    const popupElement = document.createElement('div');
    console.log('Creating popup content for:', data);
    new PopupContent({
      target: popupElement,
      props: { data },
    });
    return popupElement;
  }

  onMount(() => {

    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/standard',
      center: [-110.97, 32.16],
      zoom: 9,
    });

    updateMarkers($tacoStore);

    // track popup open or not
    map.on('popupopen', (e) => {
      activePopup.set(e.target);
    });

    map.on('popupclose', () => {
      activePopup.set(null);
    });

    return () => map.remove();
  });

  $: {
    updateMarkers($tacoStore);
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

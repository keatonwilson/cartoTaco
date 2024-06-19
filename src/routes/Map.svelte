<!-- src/routes/Map.svelte -->
<script>
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import { sites } from "../lib/stores";
  import "mapbox-gl/dist/mapbox-gl.css";
  import PopupContent from "../components/Card.svelte";

  const updateMarkers = (/** @type {any[]} */ currentSites) => {
    // Remove existing markers
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
                type: site.type
              })
            )
          )
          .addTo(map);

        markers.push(marker);
      });
    }
  };

  /**
   * @param {any} data
   */
  function createPopupContent(data) {
    const popupElement = document.createElement("div");
    new PopupContent({
      target: popupElement,
      props: { data },
    });
    return popupElement;
  }

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

  /**
   * @type {{ remove: () => any; }}
   */
  let map;
  /**
   * @type {any[]}
   */
  let markers = [];

  onMount(() => {
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/standard",
      center: [-110.97, 32.16],
      zoom: 9,
    });

    updateMarkers($sites);

    return () => map.remove();
  });

  $: {
    updateMarkers($sites);
  }
</script>

<div id="map"></div>

<style>
  #map {
    width: 100%;
    height: 100vh;
  }
</style>

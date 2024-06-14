<!-- src/routes/Map.svelte -->
<script>
  import { onMount } from "svelte";
  import mapboxgl from "mapbox-gl";
  import { sites } from "../lib/stores";
  import "mapbox-gl/dist/mapbox-gl.css";
  import Card from "../components/Card.svelte";
  import { getContext } from "svelte";

  /**
   * Function that creates a new card
   * @param {{ name: any; type: any; }} site
   */
  function createPopupElement(site) {
    const popupDiv = document.createElement("div");
    new Card({
      target: popupDiv,
      props: {
        name: site.name,
        type: site.type
      },
    });
    return popupDiv;
  }

  const updateMarkers = (/** @type {any[]} */ currentSites) => {
      if (map && currentSites) {
        currentSites.forEach(site => {
          new mapboxgl.Marker()
            .setLngLat([site.lon_1, site.lat_1])
            .setPopup(new mapboxgl.Popup().setDOMContent(createPopupElement(site)))
            .addTo(map);
        });
      }
    };

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_KEY;

  /**
   * @type {{ remove: () => any; }}
   */
  let map;

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

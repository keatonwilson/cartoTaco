import PopupContent from '../components/Card.svelte';
import mapboxgl from 'mapbox-gl';
import { selectedSite } from './stores';
import { deviceType } from './deviceDetection';
import { get } from 'svelte/store';

// Keep track of active popup
let currentPopup = null;

// Convert processed sites to GeoJSON format
function sitesToGeoJSON(processedSites) {
  return {
    type: 'FeatureCollection',
    features: processedSites
      .filter(site => site && site.longitude && site.latitude)
      .map(site => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [site.longitude, site.latitude]
        },
        properties: {
          est_id: site.est_id,
          name: site.name,
          type: site.type,
          // Store the full site data as a stringified JSON for retrieval
          // (Mapbox properties don't support nested objects well)
          siteData: JSON.stringify(site)
        }
      }))
  };
}

export const updateMarkers = (processedSites, map, markers, summaryStats) => {
  // Validate inputs to prevent errors
  if (!map) return;

  // Ensure we have arrays to work with
  if (!Array.isArray(processedSites)) {
    processedSites = [];
  }

  // Wait for map to be loaded
  if (!map.loaded()) {
    map.once('load', () => updateMarkers(processedSites, map, markers, summaryStats));
    return;
  }

  // Convert sites to GeoJSON
  const geojson = sitesToGeoJSON(processedSites);

  // Check if source exists, if so update it
  if (map.getSource('taco-sites')) {
    map.getSource('taco-sites').setData(geojson);
    return;
  }

  // Add source with clustering enabled
  map.addSource('taco-sites', {
    type: 'geojson',
    data: geojson,
    cluster: true,
    clusterMaxZoom: 14, // Max zoom to cluster points on
    clusterRadius: 50 // Radius of each cluster when clustering points
  });

  // Add cluster circles layer
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'taco-sites',
    filter: ['has', 'point_count'],
    paint: {
      // Use step expressions to create graduated circle sizes
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#FE795D', // Orange for small clusters (2-10 points)
        10,
        '#F4511E', // Darker orange for medium clusters (10-20 points)
        20,
        '#BF360C'  // Dark red for large clusters (20+ points)
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20,  // 20px radius for small clusters
        10,
        30,  // 30px radius for medium clusters
        20,
        40   // 40px radius for large clusters
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });

  // Add cluster count labels
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'taco-sites',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 14
    },
    paint: {
      'text-color': '#ffffff'
    }
  });

  // Add unclustered points layer
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#FE795D',
      'circle-radius': 10,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });

  // Add labels for unclustered points
  map.addLayer({
    id: 'unclustered-point-label',
    type: 'symbol',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-offset': [0, 1.5],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#333',
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  });

  // Click handler for clusters - zoom in
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['clusters']
    });
    const clusterId = features[0].properties.cluster_id;

    map.getSource('taco-sites').getClusterExpansionZoom(
      clusterId,
      (err, zoom) => {
        if (err) return;

        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom
        });
      }
    );
  });

  // Click handler for unclustered points - show popup
  map.on('click', 'unclustered-point', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;

    // Parse the site data back from JSON
    const siteData = JSON.parse(properties.siteData);

    // Close any existing popup
    if (currentPopup) {
      currentPopup.remove();
    }

    // Set the selected site in the store
    selectedSite.set(siteData);

    // Get current device type for responsive popup options
    const currentDeviceType = get(deviceType);

    // Device-specific popup options
    const popupOptions = {
      closeButton: true,
      closeOnClick: true,
      maxWidth: currentDeviceType === 'mobile' ? 'calc(100vw - 20px)' :
                currentDeviceType === 'tablet' ? '700px' : '800px'
    };

    // Mobile: top-anchored (popup extends downward) to avoid overlapping with search bar at top
    // Desktop/Tablet: use default positioning (no anchor specified)
    if (currentDeviceType === 'mobile') {
      popupOptions.anchor = 'top';
      popupOptions.offset = [0, 10]; // Add 10px offset below the marker
    }

    // Create popup
    currentPopup = new mapboxgl.Popup(popupOptions)
      .setLngLat(coordinates)
      .setDOMContent(createPopupContent(properties.est_id))
      .addTo(map);

    // Adjust popup position
    currentPopup.on('open', () => {
      adjustPopupPosition(currentPopup, map);
    });
  });

  // Change cursor on hover over clusters
  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
  });

  // Change cursor on hover over unclustered points
  map.on('mouseenter', 'unclustered-point', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'unclustered-point', () => {
    map.getCanvas().style.cursor = '';
  });
};

function createPopupContent(siteId) {
  try {
    const popupElement = document.createElement('div');
    new PopupContent({
      target: popupElement,
      props: { siteId }
    });
    return popupElement;
  } catch (error) {
    console.error('Error creating popup content:', error);
    const errorElement = document.createElement('div');
    errorElement.textContent = 'Error loading content';
    return errorElement;
  }
}

function adjustPopupPosition(popup, map) {
  try {
    const popupElement = popup._content;
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();

    // Get popup position relative to the map
    const popupLeft = popupRect.left - mapRect.left;
    const popupTop = popupRect.top - mapRect.top;

    // Adjust the popup position if it's off the screen
    let offsetX = 0;
    let offsetY = 0;

    if (popupLeft < 0) {
      offsetX = -popupLeft;
    } else if (popupLeft + popupRect.width > mapRect.width) {
      offsetX = mapRect.width - (popupLeft + popupRect.width);
    }

    if (popupTop < 0) {
      offsetY = -popupTop;
    } else if (popupTop + popupRect.height > mapRect.height) {
      offsetY = mapRect.height - (popupTop + popupRect.height);
    }

    popup.setOffset([offsetX, offsetY]);
  } catch (error) {
    console.error('Error adjusting popup position:', error);
  }
}
import PopupContent from '../components/Card.svelte';
import mapboxgl from 'mapbox-gl';
import { selectedSite } from './stores';
import { deviceType } from './deviceDetection';
import { get } from 'svelte/store';
import { trailModeActive, trailStops, addStop, removeStop } from './trailStore';

// Keep track of active popup
let currentPopup = null;

// Track whether event listeners have been attached
let listenersAttached = false;

// Track hovered feature for hover effects
let hoveredFeatureId = null;

// Store handler references for cleanup
let handlers = {};

// Remove existing event listeners from the map and reset state
export const resetListeners = (map) => {
  if (map && listenersAttached) {
    for (const [key, handler] of Object.entries(handlers)) {
      const [event, layer] = key.split('::');
      map.off(event, layer, handler);
    }
  }
  handlers = {};
  listenersAttached = false;
  hoveredFeatureId = null;
  clearTrailLayers(map);
};

// Convert processed sites to GeoJSON format
function sitesToGeoJSON(processedSites) {
  return {
    type: 'FeatureCollection',
    features: processedSites
      .filter(site => site && site.longitude && site.latitude)
      .map(site => ({
        type: 'Feature',
        id: site.est_id, // Required for feature-state hover effects
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

export const updateMarkers = (processedSites, map) => {
  // Validate inputs to prevent errors
  if (!map) return;

  // Ensure we have arrays to work with
  if (!Array.isArray(processedSites)) {
    processedSites = [];
  }

  // Wait for map to be loaded
  if (!map.loaded()) {
    map.once('load', () => updateMarkers(processedSites, map));
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

  // Add unclustered points layer with hover effects
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#FE795D',
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        14, // Larger radius on hover
        10  // Default radius
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3, // Thicker stroke on hover
        2  // Default stroke
      ],
      'circle-stroke-color': '#fff',
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1,   // Full opacity on hover
        0.9  // Slightly transparent by default
      ],
      'circle-stroke-opacity': 1
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

  // Attach event listeners only once
  if (!listenersAttached) {
    listenersAttached = true;

    // Click handler for clusters - zoom in
    handlers['click::clusters'] = (e) => {
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
    };
    map.on('click', 'clusters', handlers['click::clusters']);

    // Click handler for unclustered points - show popup or add to trail
    handlers['click::unclustered-point'] = (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;

      // Parse the site data back from JSON
      const siteData = JSON.parse(properties.siteData);

      // Trail mode: add/remove stop instead of opening popup
      if (get(trailModeActive)) {
        const alreadyAdded = get(trailStops).find((s) => s.est_id === siteData.est_id);
        alreadyAdded ? removeStop(siteData.est_id) : addStop(siteData);
        return;
      }

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
                  currentDeviceType === 'tablet' ? '580px' : '650px'
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
    };
    map.on('click', 'unclustered-point', handlers['click::unclustered-point']);

    // Change cursor on hover over clusters
    handlers['mouseenter::clusters'] = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    map.on('mouseenter', 'clusters', handlers['mouseenter::clusters']);

    handlers['mouseleave::clusters'] = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('mouseleave', 'clusters', handlers['mouseleave::clusters']);

    // Change cursor and apply hover effect on unclustered points
    handlers['mouseenter::unclustered-point'] = (e) => {
      map.getCanvas().style.cursor = 'pointer';

      // Set hover state for the feature
      if (e.features.length > 0) {
        // Remove hover from previous feature
        if (hoveredFeatureId !== null) {
          map.setFeatureState(
            { source: 'taco-sites', id: hoveredFeatureId },
            { hover: false }
          );
        }

        // Set hover on new feature
        hoveredFeatureId = e.features[0].id;
        map.setFeatureState(
          { source: 'taco-sites', id: hoveredFeatureId },
          { hover: true }
        );
      }
    };
    map.on('mouseenter', 'unclustered-point', handlers['mouseenter::unclustered-point']);

    handlers['mouseleave::unclustered-point'] = () => {
      map.getCanvas().style.cursor = '';

      // Remove hover state
      if (hoveredFeatureId !== null) {
        map.setFeatureState(
          { source: 'taco-sites', id: hoveredFeatureId },
          { hover: false }
        );
        hoveredFeatureId = null;
      }
    };
    map.on('mouseleave', 'unclustered-point', handlers['mouseleave::unclustered-point']);
  }
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

// Fly to a site and open its popup
export function flyToSite(map, site) {
  if (!map || !site) return;

  // Fly to the location
  map.flyTo({
    center: [site.longitude, site.latitude],
    zoom: 15,
    duration: 1000
  });

  // Open popup when map finishes moving
  map.once('moveend', () => {
    // Set the selected site in the store
    selectedSite.set(site);

    // Get current device type for responsive popup options
    const currentDeviceType = get(deviceType);

    // Device-specific popup options
    const popupOptions = {
      closeButton: true,
      closeOnClick: true,
      maxWidth: currentDeviceType === 'mobile' ? 'calc(100vw - 20px)' :
                currentDeviceType === 'tablet' ? '580px' : '650px'
    };

    // Mobile: top-anchored to avoid overlapping with header
    if (currentDeviceType === 'mobile') {
      popupOptions.anchor = 'top';
      popupOptions.offset = [0, 10];
    }

    // Close existing popup if any
    if (currentPopup) {
      currentPopup.remove();
    }

    // Create new popup
    currentPopup = new mapboxgl.Popup(popupOptions)
      .setLngLat([site.longitude, site.latitude])
      .setDOMContent(createPopupContent(site.est_id))
      .addTo(map);

    // Adjust popup position
    currentPopup.on('open', () => {
      adjustPopupPosition(currentPopup, map);
    });
  });
}

/**
 * Create or update the trail stop markers (numbered orange circles) on the map.
 * @param {object} map - Mapbox GL map instance
 * @param {object[]} stops - Ordered array of processedSite objects
 */
export function updateTrailLayers(map, stops) {
  if (!map || !map.loaded()) return;

  const geojson = {
    type: 'FeatureCollection',
    features: (stops || []).map((stop, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [stop.longitude, stop.latitude]
      },
      properties: {
        est_id: stop.est_id,
        name: stop.name,
        stop_number: String(index + 1)
      }
    }))
  };

  if (map.getSource('trail-stops')) {
    map.getSource('trail-stops').setData(geojson);
    return;
  }

  map.addSource('trail-stops', { type: 'geojson', data: geojson });

  map.addLayer({
    id: 'trail-stop-circles',
    type: 'circle',
    source: 'trail-stops',
    paint: {
      'circle-color': '#FE795D',
      'circle-radius': 14,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  });

  map.addLayer({
    id: 'trail-stop-numbers',
    type: 'symbol',
    source: 'trail-stops',
    layout: {
      'text-field': ['get', 'stop_number'],
      'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': 12
    },
    paint: {
      'text-color': '#ffffff'
    }
  });
}

/**
 * Create or update the trail route line on the map.
 * Inserted below trail-stop-circles so numbered markers render on top.
 * @param {object} map - Mapbox GL map instance
 * @param {object|null} routeGeojson - GeoJSON LineString geometry or null
 */
export function updateTrailRoute(map, routeGeojson) {
  if (!map || !map.loaded()) return;

  const geojson = {
    type: 'FeatureCollection',
    features: routeGeojson
      ? [{ type: 'Feature', geometry: routeGeojson }]
      : []
  };

  if (map.getSource('trail-route')) {
    map.getSource('trail-route').setData(geojson);
    return;
  }

  map.addSource('trail-route', { type: 'geojson', data: geojson });

  // Insert below trail-stop-circles so numbers render on top
  const beforeId = map.getLayer('trail-stop-circles') ? 'trail-stop-circles' : undefined;

  map.addLayer(
    {
      id: 'trail-route-line',
      type: 'line',
      source: 'trail-route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#FE795D',
        'line-width': 4,
        'line-opacity': 0.8,
        'line-dasharray': [2, 2]
      }
    },
    beforeId
  );
}

/**
 * Remove all trail layers and sources from the map.
 * @param {object} map - Mapbox GL map instance
 */
export function clearTrailLayers(map) {
  if (!map) return;
  try {
    ['trail-stop-numbers', 'trail-stop-circles', 'trail-route-line'].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    ['trail-stops', 'trail-route'].forEach((sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });
  } catch {
    // Map may be in the middle of a style change — ignore
  }
}
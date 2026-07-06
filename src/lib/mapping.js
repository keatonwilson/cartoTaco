import PopupContent from '../components/Card.svelte';
import PendingPopupContent from '../components/PendingSpotCard.svelte';
import mapboxgl from 'mapbox-gl';
import { selectedSite } from './stores';
import { deviceType } from './deviceDetection';
import { get } from 'svelte/store';
import { trailModeActive, trailStops, addStop, removeStop } from './trailStore';
import { mapLens } from './mapLensStore';
import { SEQUENTIAL, PENDING } from './chartTheme';

// Keep track of active popup and its associated Svelte component
let currentPopup = null;
let currentPopupComponent = null;

/**
 * Returns the bottom padding (px) that the map should use to keep a tapped
 * marker visible above the mobile bottom sheet.  Accounts for landscape mode
 * where the sheet is shallower (45 % rather than 65 %).
 */
function getSheetPadding() {
  if (typeof window === 'undefined') return 300;
  const landscape = window.innerWidth > window.innerHeight && window.innerHeight < 500;
  return Math.round(window.innerHeight * (landscape ? 0.45 : 0.65));
}

// Track which map instance currently has listeners attached (null = none)
let listenersMap = null;

// Track hovered feature for hover effects
let hoveredFeatureId = null;

// Store handler references for cleanup
let handlers = {};

function destroyCurrentPopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  if (currentPopupComponent) {
    try { currentPopupComponent.$destroy(); } catch {}
    currentPopupComponent = null;
  }
}

// Remove existing event listeners from the map and reset state
export const resetListeners = (map) => {
  if (listenersMap && Object.keys(handlers).length > 0) {
    for (const [key, handler] of Object.entries(handlers)) {
      const [event, layer] = key.split('::');
      try { listenersMap.off(event, layer, handler); } catch {}
    }
  }
  handlers = {};
  listenersMap = null;
  hoveredFeatureId = null;
  clearTrailLayers(map);
};

/**
 * Register the establishment-type glyphs as map images (U3). Drawn on an
 * offscreen canvas — no sprite files needed. White marks sit on the coral
 * marker circle. Re-run after style switches (setStyle clears images).
 */
function ensureTypeGlyphs(map) {
  if (typeof document === 'undefined') return;

  const GLYPHS = {
    'glyph-restaurant': (ctx) => {
      // Storefront: awning + body with a door notch
      ctx.fillRect(5, 9, 22, 5);
      ctx.fillRect(7, 16, 18, 11);
      ctx.clearRect(13, 20, 6, 7);
    },
    'glyph-stand': (ctx) => {
      // Market stand: tent roof + pole
      ctx.beginPath();
      ctx.moveTo(16, 6);
      ctx.lineTo(28, 18);
      ctx.lineTo(4, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(14.5, 18, 3, 9);
    },
    'glyph-truck': (ctx) => {
      // Food truck: box + cab + wheels
      ctx.fillRect(4, 10, 15, 12);
      ctx.fillRect(19, 14, 8, 8);
      ctx.beginPath();
      ctx.arc(10, 24, 3, 0, Math.PI * 2);
      ctx.arc(22, 24, 3, 0, Math.PI * 2);
      ctx.fill();
    },
    'glyph-pending': (ctx) => {
      // Question mark: unvetted spot — outranks the type glyph so
      // "not verified yet" is readable without relying on color
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 16, 17);
    }
  };

  for (const [name, draw] of Object.entries(GLYPHS)) {
    if (map.hasImage && map.hasImage(name)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    draw(ctx);
    map.addImage(name, ctx.getImageData(0, 0, 32, 32), { pixelRatio: 2 });
  }
}

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
          // Flat flag for data-driven pending styling and lens filters
          vetting_status: site.vettingStatus || 'vetted',
          // Label carries a dotted-circle prefix for pending spots so the
          // distinction doesn't rely on marker color alone
          label: site.isPending ? `◌ ${site.name}` : site.name,
          // Scalar fields for data-driven lens styling
          heat: site.heatOverall || 0,
          salsas: site.salsaCount || 0,
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
    if (map.getSource('taco-sites-all')) {
      map.getSource('taco-sites-all').setData(geojson);
    }
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

  // Unclustered twin source for the data lenses (heat / salsa / density),
  // where every spot must render individually at any zoom
  map.addSource('taco-sites-all', {
    type: 'geojson',
    data: geojson
  });

  // Add cluster circles layer
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'taco-sites',
    filter: ['has', 'point_count'],
    paint: {
      // Graduated sizes/colors from the brand's sequential ramp
      'circle-color': [
        'step',
        ['get', 'point_count'],
        SEQUENTIAL[4], // brand coral for small clusters (2-10 points)
        10,
        SEQUENTIAL[6], // deeper for medium clusters (10-20 points)
        20,
        SEQUENTIAL[8]  // deepest for large clusters (20+ points)
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

  // Register type glyph images (idempotent; re-adds after style switches)
  ensureTypeGlyphs(map);

  // Add unclustered points layer with hover effects
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    paint: {
      // Muted slate for pending (unvetted) spots, brand coral for vetted
      'circle-color': [
        'case',
        ['==', ['get', 'vetting_status'], 'pending'], PENDING.light,
        '#FE795D'
      ],
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        18, // Larger radius on hover
        14  // Default — 28 px diameter meets minimum tap-target guidelines
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
        ['case', ['==', ['get', 'vetting_status'], 'pending'], 0.7, 0.9]
      ],
      'circle-stroke-opacity': 1
    }
  });

  // Type glyph on top of each marker circle (restaurant / stand / truck).
  // Pending spots show a ? instead — "not verified" outranks "it's a truck"
  map.addLayer({
    id: 'unclustered-point-glyph',
    type: 'symbol',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': [
        'case',
        ['==', ['get', 'vetting_status'], 'pending'], 'glyph-pending',
        ['match',
          ['get', 'type'],
          'Brick and Mortar', 'glyph-restaurant',
          'Stand', 'glyph-stand',
          'Truck', 'glyph-truck',
          'glyph-restaurant']
      ],
      'icon-size': 0.85,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  });

  // Add labels for unclustered points (pending labels are prefixed ◌ and grayed)
  map.addLayer({
    id: 'unclustered-point-label',
    type: 'symbol',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-offset': [0, 1.5],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'vetting_status'], 'pending'], '#64748B',
        '#333'
      ],
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  });

  // ─── Lens layers (hidden until a data lens is active) ───
  // All three exclude pending (unvetted) spots: they carry no measurements,
  // and their implicit zeros would render as the lightest ramp step and lie.

  // Individual points for the heat/salsa lenses — unclustered at every zoom
  map.addLayer({
    id: 'lens-points',
    type: 'circle',
    source: 'taco-sites-all',
    filter: ['!=', ['get', 'vetting_status'], 'pending'],
    layout: { visibility: 'none' },
    paint: {
      'circle-color': SEQUENTIAL[4],
      'circle-radius': 11,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
      'circle-opacity': 0.95
    }
  });

  map.addLayer({
    id: 'lens-points-label',
    type: 'symbol',
    source: 'taco-sites-all',
    filter: ['!=', ['get', 'vetting_status'], 'pending'],
    layout: {
      visibility: 'none',
      'text-field': ['get', 'name'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top'
    },
    paint: {
      'text-color': '#333',
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  });

  // Density heatmap lens — brand sequential ramp over transparent.
  // Claims "where the taco spots concentrate"; unverified spots don't thicken it
  map.addLayer({
    id: 'lens-heatmap',
    type: 'heatmap',
    source: 'taco-sites-all',
    filter: ['!=', ['get', 'vetting_status'], 'pending'],
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': 1,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 3],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 20, 15, 60],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(255, 241, 238, 0)',
        0.2, SEQUENTIAL[2],
        0.4, SEQUENTIAL[3],
        0.6, SEQUENTIAL[4],
        0.8, SEQUENTIAL[6],
        1, SEQUENTIAL[8]
      ],
      'heatmap-opacity': 0.8
    }
  });

  // Restore whichever lens is active (updateMarkers re-runs after style changes)
  applyLens(map, get(mapLens));

  // Attach event listeners whenever we have a new map instance
  if (listenersMap !== map) {
    listenersMap = map;

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

      // Close any existing popup (and destroy its Svelte component)
      destroyCurrentPopup();

      // Set the selected site in the store
      selectedSite.set(siteData);

      const currentDeviceType = get(deviceType);

      if (currentDeviceType === 'mobile') {
        // On mobile, Map.svelte renders a bottom sheet instead of a Mapbox popup.
        // Center the tapped marker in the visible map area above the sheet.
        map.easeTo({
          center: coordinates,
          padding: { top: 0, bottom: getSheetPadding(), left: 0, right: 0 },
          duration: 350
        });
        return;
      }

      // Desktop/tablet: render card inside a Mapbox popup
      const popupOptions = {
        closeButton: true,
        closeOnClick: true,
        maxWidth: currentDeviceType === 'tablet' ? '580px' : '650px'
      };

      currentPopup = new mapboxgl.Popup(popupOptions)
        .setLngLat(coordinates)
        .setDOMContent(createPopupContent(properties.est_id))
        .addTo(map);

      currentPopup.on('open', () => {
        adjustPopupPosition(currentPopup, map);
      });

      currentPopup.on('close', () => {
        selectedSite.set(null);
        currentPopup = null;
        if (currentPopupComponent) {
          try { currentPopupComponent.$destroy(); } catch {}
          currentPopupComponent = null;
        }
      });
    };
    map.on('click', 'unclustered-point', handlers['click::unclustered-point']);

    // Lens points open the same popup/sheet as regular markers
    handlers['click::lens-points'] = handlers['click::unclustered-point'];
    map.on('click', 'lens-points', handlers['click::lens-points']);

    handlers['mouseenter::lens-points'] = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    map.on('mouseenter', 'lens-points', handlers['mouseenter::lens-points']);

    handlers['mouseleave::lens-points'] = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('mouseleave', 'lens-points', handlers['mouseleave::lens-points']);

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

// Layer groups toggled by the lenses
const SPOTS_LAYERS = [
  'clusters',
  'cluster-count',
  'unclustered-point',
  'unclustered-point-glyph',
  'unclustered-point-label'
];
const LENS_POINT_LAYERS = ['lens-points', 'lens-points-label'];

/**
 * Switch the active map lens (N3). Pure layer-visibility + paint changes on
 * layers created by updateMarkers; safe to call any time (no-ops until the
 * lens layers exist).
 * @param {object} map - Mapbox GL map instance
 * @param {'spots'|'heat'|'salsa'|'density'} lensId
 */
export function applyLens(map, lensId) {
  if (!map || !map.getLayer || !map.getLayer('lens-points')) return;

  const setVisible = (ids, on) =>
    ids.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    });

  setVisible(SPOTS_LAYERS, lensId === 'spots');
  setVisible(LENS_POINT_LAYERS, lensId === 'heat' || lensId === 'salsa');
  setVisible(['lens-heatmap'], lensId === 'density');

  if (lensId === 'heat') {
    // Sequential coral ramp keyed to heat_overall
    map.setPaintProperty('lens-points', 'circle-color', [
      'interpolate',
      ['linear'],
      ['get', 'heat'],
      0, SEQUENTIAL[1],
      5, SEQUENTIAL[4],
      10, SEQUENTIAL[8]
    ]);
    map.setPaintProperty('lens-points', 'circle-radius', 11);
  } else if (lensId === 'salsa') {
    // Constant brand color; radius carries the salsa count
    map.setPaintProperty('lens-points', 'circle-color', SEQUENTIAL[4]);
    map.setPaintProperty('lens-points', 'circle-radius', [
      'interpolate',
      ['linear'],
      ['get', 'salsas'],
      0, 5,
      12, 24
    ]);
  }
}

function createPopupContent(siteId) {
  try {
    const popupElement = document.createElement('div');
    // Pending (unvetted) spots get the lightweight preliminary card
    const CardComponent = get(selectedSite)?.isPending
      ? PendingPopupContent
      : PopupContent;
    currentPopupComponent = new CardComponent({
      target: popupElement,
      props: { siteId }
    });
    return popupElement;
  } catch (error) {
    console.error('Error creating popup content:', error);
    currentPopupComponent = null;
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

// Fly to a site and open its popup (or bottom sheet on mobile)
export function flyToSite(map, site) {
  if (!map || !site) return;

  const currentDeviceType = get(deviceType);

  if (currentDeviceType === 'mobile') {
    // On mobile, use the bottom sheet — center marker in visible area above it.
    destroyCurrentPopup();
    selectedSite.set(site);
    map.easeTo({
      center: [site.longitude, site.latitude],
      zoom: 15,
      padding: { top: 0, bottom: getSheetPadding(), left: 0, right: 0 },
      duration: 600
    });
    return;
  }

  // Desktop/tablet: fly to location then show popup
  map.flyTo({
    center: [site.longitude, site.latitude],
    zoom: 15,
    duration: 1000
  });

  map.once('moveend', () => {
    selectedSite.set(site);

    const popupOptions = {
      closeButton: true,
      closeOnClick: true,
      maxWidth: currentDeviceType === 'tablet' ? '580px' : '650px'
    };

    destroyCurrentPopup();

    currentPopup = new mapboxgl.Popup(popupOptions)
      .setLngLat([site.longitude, site.latitude])
      .setDOMContent(createPopupContent(site.est_id))
      .addTo(map);

    currentPopup.on('open', () => {
      adjustPopupPosition(currentPopup, map);
    });

    currentPopup.on('close', () => {
      selectedSite.set(null);
      currentPopup = null;
      if (currentPopupComponent) {
        try { currentPopupComponent.$destroy(); } catch {}
        currentPopupComponent = null;
      }
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
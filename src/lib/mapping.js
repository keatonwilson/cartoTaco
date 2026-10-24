import { selectedSite, hasValidCoordinates } from './stores';
import { deviceType } from './deviceDetection';
import { get } from 'svelte/store';
import { trailModeActive, trailStops, addStop, removeStop } from './trailStore';
import { comparisonActive } from './comparisonStore';
import { peekSite, chatOpen, CHAT_PANEL_WIDTH } from './uiStore';
import { mapLens } from './mapLensStore';
import { SEQUENTIAL, PENDING, CLOSED } from './chartTheme';

// Data lenses (heat / salsa / density) only ever show spots with real, current
// measurements: pending spots have none, closed spots' are history.
const LENS_FILTER = [
  'all',
  ['!=', ['get', 'vetting_status'], 'pending'],
  ['!', ['get', 'closed']]
];

// Track which map instance currently has listeners attached (null = none)
let listenersMap = null;

// Track hovered feature for hover effects
let hoveredFeatureId = null;

// Store handler references for cleanup
let handlers = {};

// The moveend listener a pending flyTo is waiting on, so a second fly-to
// request can cancel the first instead of racing it.
let pendingFlyToHandler = null;

// Camera bookkeeping for the desktop/tablet spot panel. Started when the panel
// opens over a map that had none, cleared when it closes. `before` is the view
// to return to, used only when opening zoomed the map in and the user hasn't
// moved it since; otherwise closing leaves the map where it is.
let panelSession = null;

// Opening a spot from further out than PANEL_ZOOM_IN_BELOW zooms to PANEL_ZOOM;
// closer than that, the camera only pans.
const PANEL_ZOOM = 15;
const PANEL_ZOOM_IN_BELOW = 13;

// Peek card timing: a short delay so sweeping the cursor across pins doesn't
// flicker, and a grace period so the pointer can travel from pin to card.
const PEEK_SHOW_DELAY = 150;
const PEEK_HIDE_GRACE = 120;
let peekShowTimer = null;
let peekHideTimer = null;
let peekPendingId = null;

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

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function canHover() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches;
}

/**
 * Width (px) of the desktop/tablet spot panel. SpotPanel renders at this
 * width and the camera pads by it, so the two can't drift apart.
 */
export function spotPanelWidth(viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280) {
  return Math.round(Math.min(560, Math.max(360, viewportWidth * 0.38)));
}

// --header-h is kept in sync with the real header by Header.svelte
function headerHeight() {
  if (typeof document === 'undefined') return 0;
  const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
  return Number.isFinite(h) ? h : 0;
}

/**
 * Camera padding for whatever covers the map right now: the mobile sheet, the
 * desktop spot panel, or an open trail/comparison tray.
 * @param {{ panelOpen?: boolean }} [opts] - count the panel as open (or not)
 *   regardless of the selection, for flights that open it on arrival
 */
export function computeMapPadding({ panelOpen } = {}) {
  const padding = { top: 0, bottom: 0, left: 0, right: 0 };
  const site = get(selectedSite);

  if (get(deviceType) === 'mobile') {
    if (site) padding.bottom = getSheetPadding();
  } else if (panelOpen ?? !!site) {
    padding.left = spotPanelWidth();
    padding.top = headerHeight();
  }
  // The concierge panel docks right, under the header, on desktop/tablet
  if (get(deviceType) !== 'mobile' && get(chatOpen)) {
    padding.right = CHAT_PANEL_WIDTH;
    padding.top = headerHeight();
  }

  if (!padding.bottom) {
    if (get(trailModeActive)) padding.bottom = 280;
    else if (get(comparisonActive)) padding.bottom = 160;
  }
  return padding;
}

/**
 * Re-apply the overlay padding after a tray opens or the window resizes.
 * Skipped mid-animation: setPadding would cut an open/close ease short, and
 * those moves already carry the right padding.
 */
export function syncMapPadding(map) {
  if (!map || map.isMoving()) return;
  const next = computeMapPadding();
  const current = map.getPadding();
  const same = ['top', 'bottom', 'left', 'right'].every(
    (side) => Math.round(current[side] || 0) === Math.round(next[side])
  );
  if (!same) map.setPadding(next);
}

/**
 * Change the padding without the view sliding: whatever sits at the centre of
 * the new padded area becomes the new camera centre.
 */
function setPaddingInPlace(map, padding) {
  const container = map.getContainer();
  const x = padding.left + (container.clientWidth - padding.left - padding.right) / 2;
  const y = padding.top + (container.clientHeight - padding.top - padding.bottom) / 2;
  map.jumpTo({ center: map.unproject([x, y]), padding });
}

function beginPanelSession(map, targetZoom) {
  if (panelSession) return;
  const zoom = map.getZoom();
  panelSession = {
    before: { center: map.getCenter(), zoom },
    zoomedIn: targetZoom > zoom,
    userMoved: false
  };
}

// Closing undoes what opening did to the camera, unless the user has since
// moved the map themselves, in which case it stays where they put it.
function releasePanelCamera(map, session) {
  const padding = computeMapPadding({ panelOpen: false });
  if (session.zoomedIn && !session.userMoved) {
    map.easeTo({ ...session.before, padding, duration: prefersReducedMotion() ? 0 : 600 });
  } else {
    setPaddingInPlace(map, padding);
  }
}

/**
 * Close the open spot (panel or sheet) and give the map back its full width.
 * @param {object} [map] - Mapbox GL map instance
 */
export function closeSpot(map) {
  const session = panelSession;
  panelSession = null;
  if (map) cancelPendingFlyTo(map);
  peekSite.set(null);
  selectedSite.set(null);
  if (map && session) releasePanelCamera(map, session);
}

// Other things clear the selection too (the header menu, Back). Whatever did
// it, release the panel's camera on the map we're attached to.
selectedSite.subscribe((site) => {
  if (site || !panelSession) return;
  const session = panelSession;
  panelSession = null;
  if (listenersMap) releasePanelCamera(listenersMap, session);
});

function cancelPendingFlyTo(map) {
  if (!pendingFlyToHandler) return;
  try { map.off('moveend', pendingFlyToHandler); } catch {}
  pendingFlyToHandler = null;
}

/**
 * Select a site and show its card: the side panel on desktop/tablet, the
 * bottom sheet on mobile (both render from `selectedSite` in Map.svelte).
 * Shared by marker clicks, the peek card and fly-to requests.
 * @param {object} map - Mapbox GL map instance
 * @param {object} site - processedSite object
 * @param {[number, number]} coordinates - [lng, lat] of the spot
 */
function openSiteCard(map, site, coordinates) {
  peekSite.set(null);

  if (get(deviceType) === 'mobile') {
    selectedSite.set(site);
    // Keep the marker visible in the map area above the sheet
    map.easeTo({
      center: coordinates,
      padding: { top: 0, bottom: getSheetPadding(), left: 0, right: 0 },
      duration: 350
    });
    return;
  }

  // Desktop/tablet: one ease that both centres the spot in the uncovered map
  // and reserves the panel's room. Clicking another pin while the panel is
  // open keeps the original session, so closing still returns to where the
  // browsing started.
  const zoom = map.getZoom();
  const targetZoom = zoom < PANEL_ZOOM_IN_BELOW ? PANEL_ZOOM : zoom;
  beginPanelSession(map, targetZoom);
  selectedSite.set(site);
  map.easeTo({
    center: coordinates,
    zoom: targetZoom,
    padding: computeMapPadding(),
    duration: prefersReducedMotion() ? 0 : 600
  });
}

/**
 * Open a spot's card from outside the map's own handlers (the peek card).
 * @param {object} map - Mapbox GL map instance
 * @param {object} site - processedSite object
 */
export function openSpot(map, site) {
  if (!map || !site || !hasValidCoordinates(site)) return;
  cancelPendingFlyTo(map);
  openSiteCard(map, site, [site.longitude, site.latitude]);
}

/** Hide the peek card after a short grace period (the pointer may be heading to it) */
export function schedulePeekHide() {
  clearTimeout(peekShowTimer);
  clearTimeout(peekHideTimer);
  peekPendingId = null;
  peekHideTimer = setTimeout(() => peekSite.set(null), PEEK_HIDE_GRACE);
}

/** Keep the peek card up (the pointer reached it) */
export function cancelPeekHide() {
  clearTimeout(peekHideTimer);
}

// Hover-capable devices: show the peek for the pin under the cursor
function hoverPeek(feature) {
  if (!feature || get(deviceType) === 'mobile' || !canHover()) return;
  const id = feature.properties.est_id;
  const current = get(peekSite);
  clearTimeout(peekHideTimer);
  if (current?.site.est_id === id || peekPendingId === id) return;

  clearTimeout(peekShowTimer);
  peekPendingId = id;
  // Gliding from one pin to the next with a peek already up switches at once
  peekShowTimer = setTimeout(() => {
    peekPendingId = null;
    if (get(selectedSite)?.est_id === id) return; // already open in the panel
    peekSite.set({
      site: JSON.parse(feature.properties.siteData),
      lngLat: feature.geometry.coordinates.slice()
    });
  }, current ? 0 : PEEK_SHOW_DELAY);
}

// Remove existing event listeners from the map and reset state
export const resetListeners = (map) => {
  if (listenersMap && Object.keys(handlers).length > 0) {
    for (const [key, handler] of Object.entries(handlers)) {
      const [event, layer] = key.split('::');
      try {
        if (layer) listenersMap.off(event, layer, handler);
        else listenersMap.off(event, handler);
      } catch {}
    }
  }
  handlers = {};
  listenersMap = null;
  hoveredFeatureId = null;
  clearTimeout(peekShowTimer);
  clearTimeout(peekHideTimer);
  peekPendingId = null;
  if (map) cancelPendingFlyTo(map);
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
    'glyph-closed': (ctx) => {
      // X: permanently closed — outranks both the pending ? and the type
      // glyph, so "don't drive here" is the first thing the marker says
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(22, 22);
      ctx.moveTo(22, 10);
      ctx.lineTo(10, 22);
      ctx.stroke();
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
export function sitesToGeoJSON(processedSites) {
  return {
    type: 'FeatureCollection',
    features: processedSites
      .filter(hasValidCoordinates)
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
          // Flat flag for data-driven closed styling and lens filters
          closed: !!site.isClosed,
          // Label carries a prefix for closed (✕) and pending (◌) spots so
          // the distinction doesn't rely on marker color alone. Closed wins.
          label: site.isClosed
            ? `✕ ${site.name}`
            : site.isPending
              ? `◌ ${site.name}`
              : site.name,
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
      // Grey for closed, muted slate for pending (unvetted), brand coral
      // for everything still open. Closed outranks pending.
      'circle-color': [
        'case',
        ['get', 'closed'], CLOSED.light,
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
        ['case',
          ['get', 'closed'], 0.55,
          ['==', ['get', 'vetting_status'], 'pending'], 0.7,
          0.9]
      ],
      'circle-stroke-opacity': 1
    }
  });

  // Type glyph on top of each marker circle (restaurant / stand / truck).
  // Closed spots show an ✕ and pending spots a ? instead — "don't go" and
  // "not verified" both outrank "it's a truck"
  map.addLayer({
    id: 'unclustered-point-glyph',
    type: 'symbol',
    source: 'taco-sites',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': [
        'case',
        ['get', 'closed'], 'glyph-closed',
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
        ['get', 'closed'], CLOSED.dark,
        ['==', ['get', 'vetting_status'], 'pending'], '#64748B',
        '#333'
      ],
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  });

  // ─── Lens layers (hidden until a data lens is active) ───
  // All three exclude pending (unvetted) spots — no measurements, and their
  // implicit zeros would render as the lightest ramp step and lie — and closed
  // spots, whose measurements are history and shouldn't shape today's picture.

  // Individual points for the heat/salsa lenses — unclustered at every zoom
  map.addLayer({
    id: 'lens-points',
    type: 'circle',
    source: 'taco-sites-all',
    filter: LENS_FILTER,
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
    filter: LENS_FILTER,
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
    filter: LENS_FILTER,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': 1,
      // Tucson's spots are sparse enough that the stock radius drew one blob
      // per spot and nothing between them — a dot map in heatmap clothing.
      // A radius wide enough for neighbouring spots' tails to overlap is what
      // turns it into a field, so it scales roughly with the city at each zoom.
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 30, 11, 70, 15, 120],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 15, 3],
      // The ramp picks up colour early: spreading the radius lowers the peak
      // density, so stops set for tight blobs would render mostly transparent.
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(255, 241, 238, 0)',
        0.1, SEQUENTIAL[1],
        0.3, SEQUENTIAL[3],
        0.5, SEQUENTIAL[4],
        0.7, SEQUENTIAL[6],
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

    // Click handler for unclustered points - open the card or add to trail
    handlers['click::unclustered-point'] = (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;

      // Parse the site data back from JSON
      const siteData = JSON.parse(properties.siteData);

      // Trail mode: add/remove stop instead of opening the card
      if (get(trailModeActive)) {
        const alreadyAdded = get(trailStops).find((s) => s.est_id === siteData.est_id);
        alreadyAdded ? removeStop(siteData.est_id) : addStop(siteData);
        return;
      }

      // A tap wins over any fly-to still in flight
      cancelPendingFlyTo(map);

      // Touch tablets have no hover, so the first tap shows the peek card and
      // a second tap (on the pin or the peek's button) opens the panel
      if (get(deviceType) !== 'mobile' && !canHover()) {
        const peeking = get(peekSite)?.site.est_id === siteData.est_id;
        const open = get(selectedSite)?.est_id === siteData.est_id;
        if (!peeking && !open) {
          peekSite.set({ site: siteData, lngLat: coordinates });
          return;
        }
      }

      openSiteCard(map, siteData, coordinates);
    };
    map.on('click', 'unclustered-point', handlers['click::unclustered-point']);

    // Lens points open the same panel/sheet as regular markers
    handlers['click::lens-points'] = handlers['click::unclustered-point'];
    map.on('click', 'lens-points', handlers['click::lens-points']);

    // A click on empty map (no pin or cluster under it) is "back to
    // exploring": close the peek and the panel. Mapbox doesn't fire click
    // after a drag, so panning never closes anything. The mobile sheet keeps
    // its own dismissal (swipe down or ×).
    handlers['click::'] = (e) => {
      const layers = ['clusters', 'unclustered-point', 'lens-points'].filter((id) => map.getLayer(id));
      if (layers.length && map.queryRenderedFeatures(e.point, { layers }).length > 0) return;
      peekSite.set(null);
      if (get(deviceType) !== 'mobile' && get(selectedSite)) closeSpot(map);
    };
    map.on('click', handlers['click::']);

    // A drag or scroll-zoom of the user's own (not one of our eases) means
    // closing the panel should leave the map where they put it
    handlers['movestart::'] = (e) => {
      if (e.originalEvent && panelSession) panelSession.userMoved = true;
    };
    map.on('movestart', handlers['movestart::']);

    handlers['mouseenter::lens-points'] = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    map.on('mouseenter', 'lens-points', handlers['mouseenter::lens-points']);

    handlers['mousemove::lens-points'] = (e) => hoverPeek(e.features?.[0]);
    map.on('mousemove', 'lens-points', handlers['mousemove::lens-points']);

    handlers['mouseleave::lens-points'] = () => {
      map.getCanvas().style.cursor = '';
      schedulePeekHide();
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

    handlers['mousemove::unclustered-point'] = (e) => hoverPeek(e.features?.[0]);
    map.on('mousemove', 'unclustered-point', handlers['mousemove::unclustered-point']);

    handlers['mouseleave::unclustered-point'] = () => {
      map.getCanvas().style.cursor = '';
      schedulePeekHide();

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

// Fly to a site and open its card (side panel, or bottom sheet on mobile)
export function flyToSite(map, site) {
  if (!map || !site) return;
  // No marker was drawn for an out-of-area spot (see hasValidCoordinates), so
  // there is nothing to fly to — "Surprise Me" would just sail into the ocean.
  if (!hasValidCoordinates(site)) return;

  const coordinates = [site.longitude, site.latitude];

  // A repeat request (e.g. mashing "Surprise Me") supersedes the one in flight
  cancelPendingFlyTo(map);
  peekSite.set(null);

  if (get(deviceType) === 'mobile') {
    // On mobile, use the bottom sheet — center marker in visible area above it.
    selectedSite.set(site);
    map.easeTo({
      center: coordinates,
      zoom: PANEL_ZOOM,
      padding: { top: 0, bottom: getSheetPadding(), left: 0, right: 0 },
      duration: 600
    });
    return;
  }

  // Desktop/tablet: fly with the panel's room already reserved so the spot
  // lands centred in the uncovered map, then open the card on arrival. Any
  // card already open stays up until then.
  beginPanelSession(map, PANEL_ZOOM);
  map.flyTo({
    center: coordinates,
    zoom: PANEL_ZOOM,
    padding: computeMapPadding({ panelOpen: true }),
    duration: 1000
  });

  const openOnArrival = () => {
    if (pendingFlyToHandler === openOnArrival) pendingFlyToHandler = null;
    openSiteCard(map, site, coordinates);
  };

  // flyTo resolves synchronously when the camera has nowhere to travel or the
  // user prefers reduced motion — moveend has already fired by the time we get
  // here, so waiting for another one would leave the card unopened.
  if (typeof map.isMoving === 'function' && !map.isMoving()) {
    openOnArrival();
    return;
  }

  pendingFlyToHandler = openOnArrival;
  map.once('moveend', openOnArrival);
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
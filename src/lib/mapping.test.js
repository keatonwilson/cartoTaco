import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, writable } from 'svelte/store';

vi.mock('./supabaseBrowser', () => ({ supabaseBrowser: null }));
vi.mock('./favoritesStore', async () => {
  const { writable: w } = await import('svelte/store');
  return { favoriteIds: w(new Set()) };
});
vi.mock('./deviceDetection', async () => {
  const { writable: w } = await import('svelte/store');
  return { deviceType: w('desktop'), isMobile: w(false) };
});

import { flyToSite, sitesToGeoJSON, closeSpot, spotPanelWidth } from './mapping.js';
import { hasValidCoordinates } from './stores.js';
import { selectedSite } from './stores.js';
import { deviceType } from './deviceDetection';

/**
 * Minimal Mapbox GL stand-in: tracks camera calls and lets a test decide when
 * the flight lands. The camera state is just enough for the panel's
 * open/close bookkeeping.
 */
function createFakeMap({ zoom = 10 } = {}) {
  const listeners = {};
  return {
    moving: false,
    zoom,
    center: { lng: -110.97, lat: 32.16 },
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    flyToCalls: [],
    easeToCalls: [],
    jumpToCalls: [],
    isMoving() { return this.moving; },
    getZoom() { return this.zoom; },
    getCenter() { return this.center; },
    getPadding() { return this.padding; },
    getContainer() { return { clientWidth: 1440, clientHeight: 900 }; },
    unproject([x, y]) { return { x, y }; },
    flyTo(options) {
      this.flyToCalls.push(options);
      this.moving = true;
    },
    easeTo(options) {
      this.easeToCalls.push(options);
      if (options.zoom !== undefined) this.zoom = options.zoom;
    },
    jumpTo(options) { this.jumpToCalls.push(options); },
    once(event, cb) { (listeners[event] ||= []).push(cb); },
    off(event, cb) {
      listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
    },
    // Finish the current flight, firing (and clearing) moveend listeners
    settle() {
      this.moving = false;
      if (this.flyToCalls.length) this.zoom = this.flyToCalls.at(-1).zoom;
      const queued = listeners.moveend || [];
      listeners.moveend = [];
      queued.forEach((cb) => cb());
    },
    pendingMoveendCount() { return (listeners.moveend || []).length; }
  };
}

const siteA = { est_id: 1, name: 'Taco A', longitude: -110.9, latitude: 32.2 };
const siteB = { est_id: 2, name: 'Taco B', longitude: -111.0, latitude: 32.3 };

describe('flyToSite', () => {
  beforeEach(() => {
    closeSpot();
    deviceType.set('desktop');
  });

  it('opens the panel for the flown-to site, centred beside it', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    expect(get(selectedSite)).toBe(null); // nothing selected mid-flight
    expect(map.flyToCalls[0].padding.left).toBe(spotPanelWidth());
    map.settle();

    expect(get(selectedSite)).toEqual(siteA);
    const ease = map.easeToCalls.at(-1);
    expect(ease.center).toEqual([siteA.longitude, siteA.latitude]);
    expect(ease.padding.left).toBe(spotPanelWidth());
  });

  // Regression: issue #55 — every "Surprise Me" after the first one landed on
  // a card reading "No location selected"
  it('keeps the new site selected on repeat fly-tos', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    map.settle();
    expect(get(selectedSite)).toEqual(siteA);

    flyToSite(map, siteB);
    expect(get(selectedSite)).toEqual(siteA); // old card stays up mid-flight
    map.settle();

    expect(get(selectedSite)).toEqual(siteB);
  });

  it('survives many consecutive fly-tos', () => {
    const map = createFakeMap();

    for (const site of [siteA, siteB, siteA, siteB, siteA]) {
      flyToSite(map, site);
      map.settle();
      expect(get(selectedSite)).toEqual(site);
    }
  });

  it('supersedes a flight that has not landed yet', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    flyToSite(map, siteB); // interrupt mid-flight
    expect(map.pendingMoveendCount()).toBe(1);

    map.settle();

    expect(get(selectedSite)).toEqual(siteB);
  });

  it('opens the card when the flight resolves synchronously (reduced motion)', () => {
    const map = createFakeMap();
    map.flyTo = function (options) {
      this.flyToCalls.push(options);
      this.moving = false; // jumpTo path: moveend already fired
    };

    flyToSite(map, siteA);

    expect(get(selectedSite)).toEqual(siteA);
  });

  it('selects the site for the bottom sheet on mobile', () => {
    const map = createFakeMap();
    deviceType.set('mobile');

    flyToSite(map, siteA);
    expect(get(selectedSite)).toEqual(siteA);

    flyToSite(map, siteB);
    expect(get(selectedSite)).toEqual(siteB);
    expect(map.flyToCalls).toHaveLength(0);
    expect(map.easeToCalls).toHaveLength(2);
    expect(map.easeToCalls[0].padding.left).toBe(0);
  });
});

describe('closeSpot', () => {
  beforeEach(() => {
    closeSpot();
    deviceType.set('desktop');
  });

  it('returns to the view from before the panel when opening zoomed in', () => {
    const map = createFakeMap({ zoom: 10 });
    const before = map.getCenter();

    flyToSite(map, siteA);
    map.settle();
    closeSpot(map);

    expect(get(selectedSite)).toBe(null);
    const ease = map.easeToCalls.at(-1);
    expect(ease).toMatchObject({ center: before, zoom: 10 });
    expect(ease.padding.left).toBe(0);
  });

  it('only drops the padding, in place, when opening did not zoom in', () => {
    // Already at street level: the flight zooms out to 15, not in
    const map = createFakeMap({ zoom: 16 });

    flyToSite(map, siteA);
    map.settle();
    map.easeToCalls.length = 0;
    closeSpot(map);

    expect(map.easeToCalls).toHaveLength(0);
    const jump = map.jumpToCalls.at(-1);
    expect(jump.padding.left).toBe(0);
    // The new centre is whatever sits mid-screen, so nothing slides
    expect(jump.center).toEqual({ x: 720, y: 450 });
  });

  it('closes when something else clears the selection', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    map.settle();
    selectedSite.set(null);

    expect(get(selectedSite)).toBe(null);
    // No map attached through updateMarkers here, so no camera call — but a
    // fresh open must start a fresh session rather than reuse the stale one
    flyToSite(map, siteB);
    expect(map.flyToCalls.at(-1).padding.left).toBe(spotPanelWidth());
  });
});

describe('spotPanelWidth', () => {
  it('scales with the viewport between 360 and 560px', () => {
    expect(spotPanelWidth(800)).toBe(360);
    expect(spotPanelWidth(1280)).toBe(486);
    expect(spotPanelWidth(1920)).toBe(560);
  });
});

describe('coordinate validation', () => {
  it('accepts a spot inside the Tucson metro box', () => {
    expect(hasValidCoordinates(siteA)).toBe(true);
  });

  it('accepts Green Valley, at the south edge of the box', () => {
    expect(hasValidCoordinates({ longitude: -110.99477, latitude: 31.897985 })).toBe(true);
  });

  it.each([
    ['the ocean (a geocoding miss)', { longitude: 0, latitude: 0 }],
    ['swapped lat/lon', { longitude: 32.2, latitude: -110.9 }],
    ['out of state', { longitude: -118.2, latitude: 34.05 }],
    ['missing coordinates', { longitude: null, latitude: null }],
    ['non-numeric strings', { longitude: 'NA', latitude: 'NA' }]
  ])('rejects %s', (_label, coords) => {
    expect(hasValidCoordinates({ est_id: 9, name: 'Bad', ...coords })).toBe(false);
  });

  it('accepts coordinates that arrive as numeric strings', () => {
    expect(hasValidCoordinates({ longitude: '-110.9', latitude: '32.2' })).toBe(true);
  });

  it('keeps out-of-area spots out of the GeoJSON entirely', () => {
    const ocean = { est_id: 3, name: 'Ocean Taco', longitude: 0, latitude: 0 };
    const geojson = sitesToGeoJSON([siteA, ocean, siteB]);

    expect(geojson.features.map((f) => f.id)).toEqual([1, 2]);
  });
});

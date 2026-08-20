import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, writable } from 'svelte/store';

// Track every popup the module creates so tests can inspect/close them
const h = vi.hoisted(() => ({ popups: [] }));

vi.mock('mapbox-gl', () => {
  class Popup {
    constructor(options) {
      this.options = options;
      this.handlers = {};
      this.removed = false;
      h.popups.push(this);
    }
    setLngLat(lngLat) { this.lngLat = lngLat; return this; }
    setDOMContent(el) { this.content = el; return this; }
    addTo(map) { this.map = map; return this; }
    on(event, cb) { (this.handlers[event] ||= []).push(cb); return this; }
    remove() {
      this.removed = true;
      (this.handlers.close || []).forEach((cb) => cb());
    }
  }
  return { default: { Popup } };
});

// Popup cards render from the selectedSite store; a stub is enough here
vi.mock('../components/Card.svelte', () => ({
  default: class { $destroy() {} }
}));
vi.mock('../components/PendingSpotCard.svelte', () => ({
  default: class { $destroy() {} }
}));

vi.mock('./supabaseBrowser', () => ({ supabaseBrowser: null }));
vi.mock('./favoritesStore', async () => {
  const { writable: w } = await import('svelte/store');
  return { favoriteIds: w(new Set()) };
});
vi.mock('./deviceDetection', async () => {
  const { writable: w } = await import('svelte/store');
  return { deviceType: w('desktop'), isMobile: w(false) };
});

import { flyToSite } from './mapping.js';
import { selectedSite } from './stores.js';
import { deviceType } from './deviceDetection';

/**
 * Minimal Mapbox GL stand-in: tracks camera calls and lets a test decide when
 * the flight lands.
 */
function createFakeMap() {
  const listeners = {};
  return {
    moving: false,
    flyToCalls: [],
    easeToCalls: [],
    isMoving() { return this.moving; },
    flyTo(options) {
      this.flyToCalls.push(options);
      this.moving = true;
    },
    easeTo(options) { this.easeToCalls.push(options); },
    once(event, cb) { (listeners[event] ||= []).push(cb); },
    off(event, cb) {
      listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
    },
    // Finish the current flight, firing (and clearing) moveend listeners
    settle() {
      this.moving = false;
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
    h.popups.length = 0;
    selectedSite.set(null);
    deviceType.set('desktop');
    // createPopupContent needs a document; no DOM env is configured for tests
    globalThis.document = { createElement: () => ({}) };
  });

  it('opens the card for the flown-to site', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    expect(get(selectedSite)).toBe(null); // nothing selected mid-flight
    map.settle();

    expect(get(selectedSite)).toEqual(siteA);
    expect(h.popups).toHaveLength(1);
    expect(h.popups[0].lngLat).toEqual([siteA.longitude, siteA.latitude]);
  });

  // Regression: issue #55 — every "Surprise Me" after the first one landed on
  // a card reading "No location selected", because removing the previous popup
  // fired its close handler and cleared selectedSite after the new site was set
  it('keeps the new site selected on repeat fly-tos', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    map.settle();
    expect(get(selectedSite)).toEqual(siteA);

    flyToSite(map, siteB);
    map.settle();

    expect(get(selectedSite)).toEqual(siteB);
    expect(h.popups[0].removed).toBe(true);
    expect(h.popups[1].removed).toBe(false);
    expect(h.popups[1].lngLat).toEqual([siteB.longitude, siteB.latitude]);
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
    expect(h.popups).toHaveLength(1);
  });

  it('opens the card when the flight resolves synchronously (reduced motion)', () => {
    const map = createFakeMap();
    map.flyTo = function (options) {
      this.flyToCalls.push(options);
      this.moving = false; // jumpTo path: moveend already fired
    };

    flyToSite(map, siteA);

    expect(get(selectedSite)).toEqual(siteA);
    expect(h.popups).toHaveLength(1);
  });

  it('clears the selection when the user closes the popup', () => {
    const map = createFakeMap();

    flyToSite(map, siteA);
    map.settle();
    h.popups[0].handlers.close.forEach((cb) => cb());

    expect(get(selectedSite)).toBe(null);
  });

  it('selects the site for the bottom sheet on mobile', () => {
    const map = createFakeMap();
    deviceType.set('mobile');

    flyToSite(map, siteA);
    expect(get(selectedSite)).toEqual(siteA);

    flyToSite(map, siteB);
    expect(get(selectedSite)).toEqual(siteB);
    expect(h.popups).toHaveLength(0);
    expect(map.easeToCalls).toHaveLength(2);
  });
});

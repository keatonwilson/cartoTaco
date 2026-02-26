<script>
  import {
    trailModeActive,
    trailStops,
    trailTransportMode,
    trailRoute,
    trailStopCount,
    exitTrailMode,
    removeStop,
    moveStop,
    clearStops,
    fetchRoute,
    addLocationStop
  } from '../lib/trailStore.js';

  // --- My Location ---
  let locatingStart = false;
  let locatingEnd = false;
  let locationError = '';

  function getLocationAndAdd(position) {
    if (!navigator?.geolocation) {
      locationError = 'Geolocation is not supported by your browser.';
      return;
    }
    locationError = '';
    if (position === 'start') locatingStart = true;
    else locatingEnd = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        addLocationStop(
          {
            est_id: 'my_location',
            name: '📍 My Location',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          },
          position
        );
        locatingStart = false;
        locatingEnd = false;
      },
      () => {
        locationError = 'Could not get your location — check browser permissions.';
        locatingStart = false;
        locatingEnd = false;
        setTimeout(() => { locationError = ''; }, 4000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Haversine distance in miles between two lat/lng points
  function distanceMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Debounced route fetch
  let routeFetchTimeout;
  function scheduleFetch(stops, mode) {
    clearTimeout(routeFetchTimeout);
    routeFetchTimeout = setTimeout(() => {
      fetchRoute(stops, mode);
    }, 300);
  }
  $: scheduleFetch($trailStops, $trailTransportMode);

  // Update URL whenever stops or mode change while trail is active
  $: if ($trailModeActive && typeof window !== 'undefined') {
    const params = new URLSearchParams();
    if ($trailStops.length > 0) {
      params.set('trail', $trailStops.map((s) => s.est_id).join(','));
      params.set('mode', $trailTransportMode === 'driving' ? 'drive' : 'walk');
      history.replaceState({}, '', `?${params}`);
    }
  }

  // Derived distances between consecutive stops (straight-line)
  $: stopDistances = $trailStops.map((stop, i) => {
    if (i === 0) return null;
    const prev = $trailStops[i - 1];
    return distanceMiles(prev.latitude, prev.longitude, stop.latitude, stop.longitude);
  });

  // Google Maps multi-stop directions URL
  function buildDirectionsUrl(stops, mode) {
    if (stops.length < 2) return '#';
    const origin = `${stops[0].latitude},${stops[0].longitude}`;
    const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
    const waypoints =
      stops.length > 2
        ? stops
            .slice(1, -1)
            .map((s) => `${s.latitude},${s.longitude}`)
            .join('|')
        : '';
    const travelmode = mode === 'driving' ? 'driving' : 'walking';
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${travelmode}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    return url;
  }

  function openDirections() {
    const url = buildDirectionsUrl($trailStops, $trailTransportMode);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Share trail: copy current URL to clipboard
  let copied = false;
  async function shareTrail() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      // Fallback: just select the URL bar
    }
  }

  $: canAct = $trailStopCount >= 2;
</script>

<div class="trail-tray" class:visible={$trailModeActive} aria-hidden={!$trailModeActive}>
  <!-- Header row -->
  <div class="tray-header">
    <span class="tray-title">
      🌮 Taco Trail
      {#if $trailStopCount > 0}
        <span class="stop-badge">{$trailStopCount} stop{$trailStopCount !== 1 ? 's' : ''}</span>
      {/if}
    </span>

    <div class="mode-toggle">
      <button
        class="mode-btn"
        class:active={$trailTransportMode === 'walking'}
        on:click={() => trailTransportMode.set('walking')}
        aria-label="Walking mode"
        title="Walking"
      >
        🚶 Walk
      </button>
      <button
        class="mode-btn"
        class:active={$trailTransportMode === 'driving'}
        on:click={() => trailTransportMode.set('driving')}
        aria-label="Driving mode"
        title="Driving"
      >
        🚗 Drive
      </button>
    </div>

    <button class="exit-btn" on:click={exitTrailMode} aria-label="Exit Trail Mode" title="Exit Trail Mode">
      ✕
    </button>
  </div>

  <!-- Location shortcut buttons -->
  <div class="location-row">
    <button
      class="loc-btn"
      on:click={() => getLocationAndAdd('start')}
      disabled={locatingStart || locatingEnd}
      title="Use current location as first stop"
    >
      {locatingStart ? '⏳ Locating…' : '📍 Start Here'}
    </button>
    <button
      class="loc-btn"
      on:click={() => getLocationAndAdd('end')}
      disabled={locatingStart || locatingEnd}
      title="Use current location as last stop"
    >
      {locatingEnd ? '⏳ Locating…' : '📍 End Here'}
    </button>
  </div>
  {#if locationError}
    <div class="location-error">{locationError}</div>
  {/if}

  <!-- Stop list / empty state -->
  <div class="tray-body">
    {#if $trailStopCount === 0}
      <div class="empty-state">
        Tap spots on the map to add them to your trail
      </div>
    {:else}
      <ul class="stop-list">
        {#each $trailStops as stop, i (stop.est_id)}
          <li class="stop-row">
            <span class="stop-number">{i + 1}</span>
            <span class="stop-name">{stop.name}</span>
            {#if stopDistances[i] !== null}
              <span class="stop-dist">{stopDistances[i].toFixed(1)} mi</span>
            {/if}
            <div class="stop-controls">
              <button
                class="order-btn"
                disabled={i === 0}
                on:click={() => moveStop(i, i - 1)}
                aria-label="Move up"
                title="Move up"
              >↑</button>
              <button
                class="order-btn"
                disabled={i === $trailStopCount - 1}
                on:click={() => moveStop(i, i + 1)}
                aria-label="Move down"
                title="Move down"
              >↓</button>
              <button
                class="remove-btn"
                on:click={() => removeStop(stop.est_id)}
                aria-label="Remove stop"
                title="Remove stop"
              >×</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Action row -->
  <div class="tray-actions">
    <button
      class="action-btn directions-btn"
      disabled={!canAct}
      on:click={openDirections}
      title={canAct ? 'Open in Google Maps' : 'Add at least 2 stops'}
    >
      Get Directions ↗
    </button>
    <button
      class="action-btn share-btn"
      disabled={!canAct}
      on:click={shareTrail}
      title={canAct ? 'Copy shareable link' : 'Add at least 2 stops'}
    >
      {copied ? '✓ Copied!' : 'Share Trail 🔗'}
    </button>
  </div>
</div>

<style>
  .trail-tray {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: white;
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    height: 280px;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .trail-tray.visible {
    transform: translateY(0);
  }

  :global(.dark) .trail-tray {
    background: #1f2937;
    border-top-color: #374151;
  }

  /* Header */
  .tray-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  :global(.dark) .tray-header {
    border-bottom-color: #374151;
  }

  .tray-title {
    font-weight: 700;
    font-size: 15px;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  :global(.dark) .tray-title {
    color: #f9fafb;
  }

  .stop-badge {
    background: #FE795D;
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
  }

  /* Mode toggle */
  .mode-toggle {
    display: flex;
    gap: 4px;
    background: #f3f4f6;
    padding: 3px;
    border-radius: 8px;
  }

  :global(.dark) .mode-toggle {
    background: #374151;
  }

  .mode-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: transparent;
    color: #6b7280;
    transition: all 0.15s ease;
  }

  :global(.dark) .mode-btn {
    color: #9ca3af;
  }

  .mode-btn.active {
    background: #FE795D;
    color: white;
  }

  .mode-btn:hover:not(.active) {
    background: #e5e7eb;
  }

  :global(.dark) .mode-btn:hover:not(.active) {
    background: #4b5563;
  }

  /* Exit button */
  .exit-btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 16px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  :global(.dark) .exit-btn {
    background: #374151;
    color: #9ca3af;
  }

  .exit-btn:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  /* Location row */
  .location-row {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  :global(.dark) .location-row {
    border-bottom-color: #374151;
  }

  .loc-btn {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    color: #374151;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  :global(.dark) .loc-btn {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .loc-btn:hover:not(:disabled) {
    border-color: #FE795D;
    background: #fff5f2;
    color: #FE795D;
  }

  :global(.dark) .loc-btn:hover:not(:disabled) {
    background: rgba(254, 121, 93, 0.1);
    border-color: #FE795D;
    color: #FE795D;
  }

  .loc-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .location-error {
    padding: 4px 16px;
    font-size: 12px;
    color: #ef4444;
    flex-shrink: 0;
  }

  /* Body */
  .tray-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #9ca3af;
    font-size: 14px;
    text-align: center;
  }

  /* Stop list */
  .stop-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stop-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  :global(.dark) .stop-row {
    border-bottom-color: #374151;
  }

  .stop-row:last-child {
    border-bottom: none;
  }

  .stop-number {
    width: 24px;
    height: 24px;
    background: #FE795D;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .stop-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.dark) .stop-name {
    color: #f9fafb;
  }

  .stop-dist {
    font-size: 12px;
    color: #6b7280;
    flex-shrink: 0;
  }

  :global(.dark) .stop-dist {
    color: #9ca3af;
  }

  /* Stop controls */
  .stop-controls {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .order-btn,
  .remove-btn {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .order-btn {
    background: #f3f4f6;
    color: #374151;
  }

  :global(.dark) .order-btn {
    background: #374151;
    color: #d1d5db;
  }

  .order-btn:hover:not(:disabled) {
    background: #e5e7eb;
  }

  :global(.dark) .order-btn:hover:not(:disabled) {
    background: #4b5563;
  }

  .order-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .remove-btn {
    background: #fee2e2;
    color: #ef4444;
    font-size: 16px;
  }

  :global(.dark) .remove-btn {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .remove-btn:hover {
    background: #fecaca;
  }

  :global(.dark) .remove-btn:hover {
    background: rgba(239, 68, 68, 0.35);
  }

  /* Actions */
  .tray-actions {
    display: flex;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  :global(.dark) .tray-actions {
    border-top-color: #374151;
  }

  .action-btn {
    flex: 1;
    padding: 9px 16px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .directions-btn {
    background: #FE795D;
    color: white;
  }

  .directions-btn:hover:not(:disabled) {
    background: #e55a3c;
  }

  .share-btn {
    background: #f3f4f6;
    color: #374151;
  }

  :global(.dark) .share-btn {
    background: #374151;
    color: #f9fafb;
  }

  .share-btn:hover:not(:disabled) {
    background: #e5e7eb;
  }

  :global(.dark) .share-btn:hover:not(:disabled) {
    background: #4b5563;
  }

  /* Mobile tweaks */
  @media (max-width: 640px) {
    .tray-title {
      font-size: 14px;
    }

    .mode-btn {
      padding: 4px 8px;
      font-size: 12px;
    }

    .action-btn {
      font-size: 13px;
      padding: 8px 10px;
    }
  }
</style>

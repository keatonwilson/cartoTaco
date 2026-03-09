<script>
  import { goto } from '$app/navigation';
  import {
    comparisonSites,
    comparisonActive,
    comparisonCount,
    removeFromComparison,
    clearComparison,
    closeComparison
  } from '$lib/comparisonStore.js';
  import { trailModeActive } from '$lib/trailStore.js';

  // Update URL when comparison changes
  $: if ($comparisonActive && typeof window !== 'undefined') {
    if ($comparisonSites.length > 0) {
      const params = new URLSearchParams(window.location.search);
      params.set('compare', $comparisonSites.map(s => s.est_id).join(','));
      history.replaceState({}, '', `?${params}`);
    }
  }

  // Navigate to comparison view
  function compareNow() {
    const ids = $comparisonSites.map(s => s.est_id).join(',');
    goto(`/compare?ids=${ids}`);
  }

  // Share comparison link
  let copied = false;
  async function shareComparison() {
    try {
      const ids = $comparisonSites.map(s => s.est_id).join(',');
      const url = `${window.location.origin}?compare=${ids}`;
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      // Fallback: silent fail
    }
  }

  $: canAct = $comparisonCount >= 2;
  // Hide when trail mode is active to avoid stacking
  $: visible = $comparisonActive && !$trailModeActive;
</script>

<div class="comparison-tray" class:visible aria-hidden={!visible}>
  <!-- Header -->
  <div class="tray-header">
    <span class="tray-title">
      Compare Spots
      <span class="count-badge">{$comparisonCount}/{3}</span>
    </span>
    <button class="clear-btn" on:click={clearComparison} disabled={$comparisonCount === 0}>
      Clear
    </button>
    <button class="exit-btn" on:click={closeComparison} aria-label="Close comparison tray" title="Close">
      ✕
    </button>
  </div>

  <!-- Site chips -->
  <div class="tray-body">
    {#if $comparisonCount === 0}
      <div class="empty-state">Add spots from the map to compare them</div>
    {:else}
      <div class="site-chips">
        {#each $comparisonSites as site (site.est_id)}
          <div class="site-chip">
            <span class="chip-name">{site.name}</span>
            <button class="chip-remove" on:click={() => removeFromComparison(site.est_id)} aria-label="Remove {site.name}">×</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="tray-actions">
    <button
      class="action-btn compare-btn"
      disabled={!canAct}
      on:click={compareNow}
      title={canAct ? 'Compare selected spots' : 'Add at least 2 spots'}
    >
      Compare Now
    </button>
    <button
      class="action-btn share-btn"
      disabled={!canAct}
      on:click={shareComparison}
      title={canAct ? 'Copy shareable link' : 'Add at least 2 spots'}
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  </div>
</div>

<style>
  .comparison-tray {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: white;
    border-top: 2px solid #FE795D;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    height: 160px;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .comparison-tray.visible {
    transform: translateY(0);
  }

  :global(.dark) .comparison-tray {
    background: #1f2937;
    border-top-color: #FE795D;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
  }

  /* Header */
  .tray-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
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

  .count-badge {
    background: #FE795D;
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .clear-btn {
    padding: 4px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    color: #6b7280;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(.dark) .clear-btn {
    background: #374151;
    border-color: #4b5563;
    color: #9ca3af;
  }

  .clear-btn:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
  }

  .clear-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

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

  /* Body */
  .tray-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
    display: flex;
    align-items: center;
  }

  .empty-state {
    width: 100%;
    color: #9ca3af;
    font-size: 14px;
    text-align: center;
  }

  .site-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .site-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: #fff5f2;
    border: 1px solid #FE795D;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #1f2937;
  }

  :global(.dark) .site-chip {
    background: rgba(254, 121, 93, 0.1);
    color: #f9fafb;
  }

  .chip-name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-remove {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(254, 121, 93, 0.2);
    color: #FE795D;
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .chip-remove:hover {
    background: #FE795D;
    color: white;
  }

  /* Actions */
  .tray-actions {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  :global(.dark) .tray-actions {
    border-top-color: #374151;
  }

  .action-btn {
    flex: 1;
    padding: 8px 16px;
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

  .compare-btn {
    background: #FE795D;
    color: white;
  }

  .compare-btn:hover:not(:disabled) {
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

  @media (max-width: 640px) {
    .tray-title {
      font-size: 14px;
    }
    .action-btn {
      font-size: 13px;
      padding: 7px 10px;
    }
    .chip-name {
      max-width: 100px;
    }
  }
</style>

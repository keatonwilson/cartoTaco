<script>
  // Small floating legend distinguishing vetted from pending (unvetted) spots.
  // Only shown in the default Spots lens, and only when the current data
  // actually contains a pending spot — no dead chrome otherwise.
  import { filteredTacoData } from '$lib/stores';
  import { mapLens } from '$lib/mapLensStore.js';

  $: pendingCount = $filteredTacoData.filter((s) => s.isPending).length;
</script>

{#if $mapLens === 'spots' && pendingCount > 0}
  <div class="map-legend" role="note" aria-label="Map marker legend">
    <span class="legend-item">
      <span class="swatch vetted" aria-hidden="true"></span>
      Vetted
    </span>
    <span class="legend-item">
      <span class="swatch pending" aria-hidden="true">?</span>
      Pending
    </span>
  </div>
{/if}

<style>
  .map-legend {
    position: fixed;
    bottom: 28px;
    left: 10px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--surface-1);
    border: 1px solid var(--line-1, rgba(0, 0, 0, 0.08));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    line-height: 1;
  }

  .swatch.vetted {
    background: var(--accent);
  }

  .swatch.pending {
    background: var(--pending);
  }
</style>

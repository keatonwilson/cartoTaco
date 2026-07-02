<script>
  // Lens switcher: lets the map itself visualize data (N3 of the UI refresh).
  import { mapLens, LENSES } from '$lib/mapLensStore.js';

  $: activeLens = LENSES.find((l) => l.id === $mapLens);

  function select(id) {
    mapLens.set(id);
  }
</script>

<div class="lens-picker" data-tour="lenses">
  <div class="lens-chips" role="radiogroup" aria-label="Map data lens">
    {#each LENSES as lens (lens.id)}
      <button
        class="lens-chip"
        class:on={$mapLens === lens.id}
        role="radio"
        aria-checked={$mapLens === lens.id}
        on:click={() => select(lens.id)}
      >
        {lens.label}
      </button>
    {/each}
  </div>
  {#if activeLens?.legend}
    <div class="lens-legend">
      {#if $mapLens === 'heat'}
        <span class="legend-ramp" aria-hidden="true"></span>
      {:else if $mapLens === 'salsa'}
        <span class="legend-dots" aria-hidden="true">
          <span class="legend-dot" style="width:6px;height:6px"></span>
          <span class="legend-dot" style="width:10px;height:10px"></span>
          <span class="legend-dot" style="width:14px;height:14px"></span>
        </span>
      {/if}
      <span class="legend-text">{activeLens.legend}</span>
    </div>
  {/if}
</div>

<style>
  .lens-picker {
    position: absolute;
    top: 86px;
    left: 10px;
    z-index: 150;
    background: var(--surface-1);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.dark) .lens-picker {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .lens-chips {
    display: flex;
    gap: 4px;
  }

  .lens-chip {
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  @media (hover: hover) {
    .lens-chip:hover:not(.on) {
      color: var(--accent);
    }
  }

  .lens-chip.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-hover);
  }

  :global(.dark) .lens-chip.on {
    color: var(--accent);
  }

  .lens-legend {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 2px;
  }

  .legend-ramp {
    width: 56px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, #ffe4de 0%, #fe795d 50%, #a5371b 100%);
    flex-shrink: 0;
  }

  .legend-dots {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }

  .legend-dot {
    border-radius: 50%;
    background: var(--accent);
  }

  .legend-text {
    font-size: 10px;
    color: var(--ink-2);
    line-height: 1.2;
  }

  /* Mobile: sit below the full-width FilterBar header */
  @media (max-width: 768px) {
    .lens-picker {
      top: 136px;
    }
  }
</style>

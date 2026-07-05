<script>
  // Lens switcher: lets the map itself visualize data (N3 of the UI refresh).
  // Renders as a static row — FilterBar mounts it as its attached bottom strip.
  import { mapLens, LENSES } from '$lib/mapLensStore.js';

  $: activeLens = LENSES.find((l) => l.id === $mapLens);

  function select(id) {
    mapLens.set(id);
  }
</script>

<div class="lens-picker" data-tour="lenses">
  <div class="lens-row">
    <span class="lens-label">View</span>
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
            <span class="legend-dot" style="width:5px;height:5px"></span>
            <span class="legend-dot" style="width:9px;height:9px"></span>
            <span class="legend-dot" style="width:13px;height:13px"></span>
          </span>
        {/if}
        <span class="legend-text">{activeLens.legend}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .lens-picker {
    width: 100%;
  }

  .lens-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .lens-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--ink-3);
    flex-shrink: 0;
  }

  .lens-chips {
    display: flex;
    gap: 4px;
  }

  .lens-chip {
    padding: 4px 10px;
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
    min-width: 0;
  }

  .legend-ramp {
    width: 48px;
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

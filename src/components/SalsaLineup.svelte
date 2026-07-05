<script>
  // The per-salsa lineup: named varieties as chips, plus the spot's own
  // "other" salsas with individual heat dots and tap-to-reveal descriptions.
  export let salsaVarieties = [];
  export let otherSalsas = [];

  // est_id of the expanded other-salsa description (index-based key)
  let expandedIndex = null;

  function toggleExpanded(i) {
    expandedIndex = expandedIndex === i ? null : i;
  }

  // 0–10 heat → 1–5 filled dots
  function heatDots(heat) {
    const h = Number(heat);
    if (isNaN(h) || h <= 0) return 0;
    return Math.max(1, Math.min(5, Math.round(h / 2)));
  }

  $: hasAny = salsaVarieties.length > 0 || otherSalsas.length > 0;
  $: expandedSalsa = expandedIndex !== null ? otherSalsas[expandedIndex] : null;
</script>

{#if hasAny}
  <div class="salsa-lineup">
    <div class="chips">
      {#each salsaVarieties as variety}
        <span class="salsa-chip">{variety.name}</span>
      {/each}
      {#each otherSalsas as salsa, i}
        <button
          type="button"
          class="salsa-chip house-chip"
          class:expanded={expandedIndex === i}
          on:click={() => toggleExpanded(i)}
          title={salsa.heat != null ? `${salsa.name} — heat ${salsa.heat}/10` : salsa.name}
          aria-expanded={expandedIndex === i}
        >
          {salsa.name}
          {#if heatDots(salsa.heat) > 0}
            <span class="dots" aria-label={`Heat ${salsa.heat} out of 10`}>
              {#each Array(5) as _, d}
                <span class="dot" class:filled={d < heatDots(salsa.heat)}></span>
              {/each}
            </span>
          {/if}
        </button>
      {/each}
    </div>
    {#if expandedSalsa?.description}
      <p class="salsa-description">{expandedSalsa.description}</p>
    {/if}
  </div>
{:else}
  <p class="no-data">No salsa details listed for this spot.</p>
{/if}

<style>
  .salsa-lineup {
    width: 100%;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .salsa-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
    color: var(--ink-2);
    white-space: nowrap;
  }

  /* House ("other") salsas are the spot's own — accent-tinted and tappable */
  .house-chip {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-hover);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.dark) .house-chip {
    color: var(--accent);
  }

  .house-chip.expanded {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .house-chip.expanded .dot {
    background: rgba(255, 255, 255, 0.45);
  }

  .house-chip.expanded .dot.filled {
    background: var(--accent-contrast);
  }

  .dots {
    display: inline-flex;
    gap: 2px;
  }

  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--line-2);
  }

  .dot.filled {
    background: var(--accent-hover);
  }

  :global(.dark) .dot.filled {
    background: var(--accent);
  }

  .salsa-description {
    margin: 6px 0 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--ink-2);
  }

  .no-data {
    font-size: 12px;
    font-style: italic;
    color: var(--ink-3);
    margin: 0;
  }
</style>

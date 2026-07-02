<script>
  // Heat Ladder — a 10-notch meter with hero number and optional city-percentile
  // context. Replaces the old ECharts needle gauge (V2 of the UI refresh).
  import { SEQUENTIAL } from '$lib/chartTheme';

  export let spiceValue = 0;
  /** 0–100 share of spots this one is hotter than; null hides the line */
  export let percentile = null;
  /** Context line shown when no percentile is provided */
  export let explanation = 'Overall heat level across all salsas';

  // Helper function to get spice level description
  function getSpiceDescription(value) {
    if (value === 0) return 'No Heat';
    if (value <= 2) return 'Mild';
    if (value <= 4) return 'Medium';
    if (value <= 6) return 'Medium-Hot';
    if (value <= 8) return 'Hot';
    return 'Very Hot';
  }

  $: spiceDescription = getSpiceDescription(spiceValue);
  $: filled = Math.max(0, Math.min(10, Math.round(spiceValue)));

  // Notch i (0-based) wears its own step of the sequential coral ramp, so the
  // filled ladder reads light→dark up to the value. The two near-white steps
  // are dropped — they vanish on light surfaces and glare on dark ones.
  const RAMP = SEQUENTIAL.slice(2);
  function notchColor(i) {
    return RAMP[Math.round((i / 9) * (RAMP.length - 1))];
  }
</script>

<div class="gauge-wrapper">
  <div class="hero-row">
    <span class="hero-number">{spiceValue}</span>
    <span class="hero-denom">/10</span>
  </div>
  <div
    class="ladder"
    role="meter"
    aria-valuemin="0"
    aria-valuemax="10"
    aria-valuenow={spiceValue}
    aria-label={`Heat level ${spiceValue} out of 10 — ${spiceDescription}`}
  >
    {#each Array(10) as _, i}
      <span
        class="notch"
        class:filled={i < filled}
        style={i < filled ? `background:${notchColor(i)}` : ''}
      ></span>
    {/each}
  </div>
  <div class="spice-description">{spiceDescription}</div>
  <div class="spice-explanation">
    {#if percentile !== null}
      Hotter than {percentile}% of Tucson spots
    {:else}
      {explanation}
    {/if}
  </div>
</div>

<style>
  .gauge-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 3px;
  }

  .hero-row {
    display: flex;
    align-items: baseline;
    gap: 2px;
    line-height: 1;
  }

  .hero-number {
    font-family: var(--font-display);
    font-variant-numeric: tabular-nums;
    font-size: 26px;
    font-weight: 800;
    color: var(--ink-1);
  }

  .hero-denom {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-3);
  }

  .ladder {
    display: flex;
    gap: 3px;
    width: 100%;
    max-width: 130px;
  }

  .notch {
    flex: 1;
    height: 9px;
    border-radius: 2px;
    background: var(--line-1);
  }

  .spice-description {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-1);
  }

  .spice-explanation {
    font-size: 10px;
    color: var(--ink-2);
    text-align: center;
    max-width: 150px;
    line-height: 1.3;
  }
</style>

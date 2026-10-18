<script>
  // City-distribution dot strip (N4): spots binned by value on a shared scale,
  // one dot per bin sized by how many spots share it, with this spot's bin
  // ringed — turns a bare number into "where this sits in Tucson".
  import { binValues, dotRadius, describeDistribution } from '$lib/distribution';

  export let values = [];
  export let value = 0;
  export let min = 0;
  export let max = null;
  export let label = '';
  /** Bin width — 0.5 keeps fractional heat readings apart, 1 suits counts */
  export let step = 1;
  /** Phrase after the count in tooltips / aria text, e.g. v => `at heat ${v}` */
  export let binLabel = (v) => `at ${v}`;

  // Largest dot radius (px); the floor keeps a one-spot bin visible
  const MAX_R = 6;
  const MIN_R = 2;

  $: bins = binValues(values, step);
  $: maxCount = Math.max(0, ...bins.map((b) => b.count));
  $: highlight = Math.round(value / step) * step;
  $: highlightBin = bins.find((b) => b.value === highlight);
  $: resolvedMax = max ?? Math.max(1, ...values, value);
  $: range = Math.max(0.0001, resolvedMax - min);
  $: position = (v) => Math.min(100, Math.max(0, ((v - min) / range) * 100));
  $: radius = (count) => dotRadius(count, maxCount, { min: MIN_R, max: MAX_R });
  $: markerR = highlightBin ? radius(highlightBin.count) : MIN_R;
  $: summary = describeDistribution(bins, highlight, binLabel);
  $: ariaLabel = [label, summary || `This spot: ${value}`].filter(Boolean).join('. ');
</script>

<div class="context-strip" role="img" aria-label={ariaLabel}>
  <div class="strip-track">
    {#each bins as bin (bin.value)}
      {#if bin !== highlightBin}
        <span
          class="strip-dot"
          style="left: {position(bin.value)}%; width: {radius(bin.count) * 2}px; height: {radius(bin.count) * 2}px"
          title="{bin.count} {bin.count === 1 ? 'spot' : 'spots'} {binLabel(bin.value)}"
        ></span>
      {/if}
    {/each}
    <span
      class="strip-marker"
      style="left: {position(highlight)}%; width: {markerR * 2}px; height: {markerR * 2}px"
      title={highlightBin
        ? `${highlightBin.count} ${highlightBin.count === 1 ? 'spot' : 'spots'} ${binLabel(highlight)} (this one)`
        : `This spot ${binLabel(highlight)}`}
    ></span>
  </div>
  {#if label}
    <span class="strip-label">{label}</span>
  {/if}
</div>

<style>
  .context-strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 100%;
  }

  .strip-track {
    position: relative;
    width: 100%;
    max-width: 170px;
    height: 18px;
  }

  .strip-track::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    transform: translateY(-50%);
    background: var(--line-1);
    border-radius: 1px;
  }

  .strip-dot {
    position: absolute;
    top: 50%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: var(--ink-3);
    opacity: 0.35;
  }

  .strip-marker {
    position: absolute;
    top: 50%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--surface-1), 0 0 0 3px var(--accent);
  }

  .strip-label {
    font-size: 10px;
    color: var(--ink-2);
    text-align: center;
    line-height: 1.3;
  }
</style>

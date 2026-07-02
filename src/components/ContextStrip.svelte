<script>
  // City-distribution dot strip (N4): every spot as a faint dot on a shared
  // scale, with this spot highlighted — turns a bare number into "where this
  // sits in Tucson".
  export let values = [];
  export let value = 0;
  export let min = 0;
  export let max = null;
  export let label = '';

  $: resolvedMax = max ?? Math.max(1, ...values, value);
  $: range = Math.max(0.0001, resolvedMax - min);
  $: position = (v) => Math.min(100, Math.max(0, ((v - min) / range) * 100));
</script>

<div class="context-strip" role="img" aria-label={label ? `${label}. This spot: ${value}.` : `This spot: ${value}`}>
  <div class="strip-track">
    {#each values as v}
      <span class="strip-dot" style="left: {position(v)}%"></span>
    {/each}
    <span class="strip-marker" style="left: {position(value)}%"></span>
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
    height: 12px;
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
    width: 5px;
    height: 5px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: var(--ink-3);
    opacity: 0.35;
  }

  .strip-marker {
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: var(--accent);
    border: 2px solid var(--surface-1);
    box-shadow: 0 0 0 1px var(--accent);
  }

  .strip-label {
    font-size: 10px;
    color: var(--ink-2);
    text-align: center;
    line-height: 1.3;
  }
</style>

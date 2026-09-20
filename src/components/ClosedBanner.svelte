<script>
  // Banner shown at the top of any card for a permanently closed spot.
  // Loud enough that nobody drives across town, calm enough that the rest of
  // the card still reads as the historical record it now is.
  import XCircle from 'phosphor-svelte/lib/XCircle';

  /** ISO timestamp from sites.closed_at */
  export let closedAt = null;

  $: closedLabel = (() => {
    if (!closedAt) return null;
    const d = new Date(closedAt);
    if (isNaN(d)) return null;
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  })();
</script>

<div class="closed-banner" role="note">
  <span class="icon"><XCircle size={18} weight="fill" /></span>
  <span class="text">
    <strong>Permanently closed</strong>
    {#if closedLabel}<span class="since">Closed {closedLabel}</span>{/if}
  </span>
</div>

<style>
  .closed-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: 10px;
    border-radius: 10px;
    background: var(--closed-soft);
    border: 1px dashed var(--closed);
    color: var(--ink-2);
  }

  .icon {
    display: flex;
    flex-shrink: 0;
    color: var(--closed);
  }

  .text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
    line-height: 1.35;
  }

  .text strong {
    font-weight: 700;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    font-size: 11px;
  }

  .since {
    color: var(--ink-3);
  }
</style>

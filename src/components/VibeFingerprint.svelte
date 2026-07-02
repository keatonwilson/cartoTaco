<script>
  // The vibe fingerprint (N5): the four anti-review dimensions as a compact
  // shape you can compare across spots. Bars are normalized to the spot's own
  // total votes so the *profile* reads, not the raw popularity.
  import { vibeCountsByEst, loadVibeCounts, VIBE_DIMENSIONS } from '$lib/vibeVotesStore';

  export let estId;
  /** Render a "no votes yet" line instead of nothing when there are no votes */
  export let showEmpty = false;

  const LABELS = {
    heat_legit: 'Heat',
    authentic: 'Authentic',
    value: 'Value',
    vibe: 'Vibe'
  };

  $: if (estId != null) loadVibeCounts(estId);
  $: counts = $vibeCountsByEst.get(estId) || {};
  $: total = VIBE_DIMENSIONS.reduce((a, d) => a + (counts[d] || 0), 0);
  $: maxCount = Math.max(1, ...VIBE_DIMENSIONS.map((d) => counts[d] || 0));
</script>

{#if total > 0}
  <div class="fingerprint" role="img" aria-label={`Vibe fingerprint from ${total} votes`}>
    {#each VIBE_DIMENSIONS as dim (dim)}
      <div class="fp-row" title={`${LABELS[dim]}: ${counts[dim] || 0} of ${total} votes`}>
        <span class="fp-label">{LABELS[dim]}</span>
        <span class="fp-track">
          <span class="fp-bar" style="width: {((counts[dim] || 0) / maxCount) * 100}%"></span>
        </span>
        <span class="fp-count">{counts[dim] || 0}</span>
      </div>
    {/each}
  </div>
{:else if showEmpty}
  <p class="fp-empty">No vibe votes yet</p>
{/if}

<style>
  .fingerprint {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    max-width: 190px;
  }

  .fp-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .fp-label {
    width: 58px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-2);
    text-align: right;
  }

  .fp-track {
    flex: 1;
    height: 5px;
    border-radius: 3px;
    background: var(--line-1);
    overflow: hidden;
  }

  .fp-bar {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    min-width: 2px;
    transition: width 0.3s ease;
  }

  .fp-count {
    width: 14px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink-3);
  }

  .fp-empty {
    font-size: 11px;
    font-style: italic;
    color: var(--ink-3);
    margin: 0;
  }
</style>

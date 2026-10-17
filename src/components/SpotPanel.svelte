<script>
  // Desktop/tablet spot panel: docked left under the header, full height,
  // scrolling on its own so the whole card is reachable wherever the pin sits.
  // The map eases the spot into the middle of the uncovered area (mapping.js
  // pads the camera by the same width). Clicking another pin swaps the content
  // in place. Styling borrows the Salsa Atlas voice: a mono kicker, the name
  // in Fraunces, plain sections split by hairlines.
  import { createEventDispatcher } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import X from 'phosphor-svelte/lib/X';
  import Card from './Card.svelte';
  import PendingSpotCard from './PendingSpotCard.svelte';
  import FavoriteButton from './FavoriteButton.svelte';
  import IconHighlight from './IconHighlight.svelte';
  import { selectedSite } from '$lib/stores';
  import { getOpenStatus, minuteClock } from '$lib/hours';
  import {
    comparisonSites,
    comparisonCount,
    addToComparison,
    removeFromComparison
  } from '$lib/comparisonStore.js';

  /** Panel width in px (spotPanelWidth() in mapping.js) */
  export let width = 400;

  const dispatch = createEventDispatcher();

  const TYPE_LABELS = { 'Brick and Mortar': 'Restaurant', Stand: 'Stand', Truck: 'Food truck' };

  $: site = $selectedSite;
  $: region = site?.rawData?.descriptions?.region || null;
  $: kicker = [
    site?.isPending ? '◌ Pending vetting' : null,
    TYPE_LABELS[site?.type] || site?.type,
    region
  ]
    .filter(Boolean)
    .join(' · ');
  $: status = site ? getOpenStatus(site.startHours || [], site.endHours || [], $minuteClock) : null;

  $: isInComparison = $comparisonSites.some((s) => s.est_id === site?.est_id);
  $: comparisonFull = $comparisonCount >= 3 && !isInComparison;

  function toggleComparison() {
    if (!site) return;
    isInComparison ? removeFromComparison(site.est_id) : addToComparison(site);
  }

  // A new spot starts at the top of the panel
  let scroller;
  let shownId = null;
  $: if (site && site.est_id !== shownId) {
    shownId = site.est_id;
    if (scroller) scroller.scrollTop = 0;
  }

  // Slides in from the left edge. Skipped when the name is morphing in from
  // the peek card (PeekCard sets html.spot-morph for that view transition)
  // and for reduced motion.
  function slideIn(node) {
    const instant =
      document.documentElement.classList.contains('spot-morph') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant) return { duration: 0 };
    return {
      duration: 280,
      easing: cubicOut,
      css: (t) => `transform: translateX(${(t - 1) * 100}%)`
    };
  }
</script>

{#if site}
  <aside
    class="spot-panel"
    style="width:{width}px"
    aria-label={site.name || 'Spot details'}
    in:slideIn
  >
    <header class="panel-head">
      <div class="head-row">
        <p class="kicker">{kicker}</p>
        <button
          type="button"
          class="close-btn"
          on:click={() => dispatch('close')}
          aria-label="Close"
          title="Close (Esc)"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div class="name-row">
        <h2 class="spot-name">{site.name || 'Unknown Location'}</h2>
        <!-- Restaurant / stand / truck, this spot's type lit -->
        <div class="type-icons">
          <IconHighlight type="siteType" data={site.type || 'unknown'} />
        </div>
      </div>

      <div class="head-row">
        {#if site.isClosed}
          <span class="status" data-state="gone">✕ Permanently closed</span>
        {:else if status}
          <span class="status" data-state={status.state}>
            <span class="status-dot"></span>{status.label}
          </span>
        {/if}
        <div class="actions">
          <FavoriteButton estId={site.est_id} size="sm" />
          {#if !site.isClosed && !site.isPending}
            <button
              type="button"
              class="compare-btn"
              class:active={isInComparison}
              disabled={comparisonFull}
              on:click={toggleComparison}
              title={isInComparison ? 'Remove from comparison' : comparisonFull ? 'Max 3 spots' : 'Add to comparison'}
            >
              {isInComparison ? '− Compare' : '+ Compare'}
            </button>
          {/if}
        </div>
      </div>
    </header>

    <div class="panel-body" bind:this={scroller}>
      <!-- Keyed so a swapped spot re-runs the section entrance and resets
           the card's local state (read more, radar toggle) -->
      {#key site.est_id}
        {#if site.isPending}
          <PendingSpotCard hideHeader />
        {:else}
          <Card variant="panel" />
        {/if}
      {/key}
    </div>
  </aside>
{/if}

<style>
  .spot-panel {
    position: fixed;
    top: var(--header-h);
    left: 0;
    bottom: 0;
    z-index: 120; /* above the trays (50), below FilterBar (200) */
    display: flex;
    flex-direction: column;
    max-width: 100vw;
    background: var(--surface-1);
    border-right: 1px solid var(--line-1);
    box-shadow: 8px 0 28px -16px rgba(0, 0, 0, 0.35);
  }

  .panel-head {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--line-1);
    background: var(--surface-1);
  }

  .head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }

  .kicker {
    margin: 0;
    min-width: 0;
    font: 600 11px/1.3 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .type-icons {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .type-icons :global(.icons) {
    justify-content: flex-start;
    gap: 6px;
    margin: 0;
  }

  .type-icons :global(.site-icon) {
    width: 30px;
    height: 30px;
  }

  /* The kicker above already names the type in words, and a hover tooltip
     here can only land on the name or the action buttons */
  .type-icons :global(.tooltip) {
    display: none;
  }

  .spot-name {
    margin: 0;
    min-width: 0;
    font-family: var(--font-serif);
    font-weight: 650;
    font-size: 30px;
    line-height: 1.06;
    font-variation-settings: 'opsz' 72;
    letter-spacing: -0.01em;
    color: var(--ink-1);
    text-wrap: balance;
    view-transition-name: spot-title;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--error);
  }

  .status[data-state='open'] {
    color: var(--success);
  }
  .status[data-state='open'] .status-dot {
    background: var(--success);
  }
  .status[data-state='closing-soon'] {
    color: var(--warning);
  }
  .status[data-state='closing-soon'] .status-dot {
    background: var(--warning);
  }
  .status[data-state='unknown'] .status-dot {
    background: var(--ink-3);
  }
  .status[data-state='gone'] {
    color: var(--closed);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .close-btn {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    margin: -6px -6px 0 0;
    border-radius: 50%;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
    color: var(--ink-2);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .close-btn:hover {
    color: var(--accent-hover);
    border-color: var(--accent);
  }

  .close-btn:focus-visible,
  .compare-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .compare-btn {
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent-hover);
    font: 600 12px/1.4 var(--font-text);
    cursor: pointer;
    white-space: nowrap;
  }

  .compare-btn.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .compare-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 20px 28px;
  }

  /* While the name morphs from the peek card, keep the rest of the page still
     (the map is easing underneath; a root cross-fade would smear it) */
  :global(html.spot-morph::view-transition-old(root)),
  :global(html.spot-morph::view-transition-new(root)) {
    animation: none;
  }

  :global(::view-transition-group(spot-title)) {
    animation-duration: 0.32s;
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  }
</style>

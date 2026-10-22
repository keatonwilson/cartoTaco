<script>
  // Desktop/tablet spot panel: docked left under the header, full height,
  // scrolling on its own so the whole card is reachable wherever the pin sits.
  // The map eases the spot into the middle of the uncovered area (mapping.js
  // pads the camera by the same width). Clicking another pin swaps the content
  // in place. Styling borrows the Salsa Atlas voice: a mono kicker, the name
  // in Fraunces, plain sections split by hairlines.
  import { createEventDispatcher } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import Card from './Card.svelte';
  import PendingSpotCard from './PendingSpotCard.svelte';
  import SpotHeader from './SpotHeader.svelte';
  import { selectedSite } from '$lib/stores';

  /** Panel width in px (spotPanelWidth() in mapping.js) */
  export let width = 400;

  const dispatch = createEventDispatcher();

  $: site = $selectedSite;

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
    <div class="panel-head">
      <SpotHeader {site} on:close={() => dispatch('close')} />
    </div>

    <div class="panel-body" bind:this={scroller}>
      <!-- Keyed so a swapped spot re-runs the section entrance and resets
           the card's local state (read more, radar toggle) -->
      {#key site.est_id}
        {#if site.isPending}
          <PendingSpotCard hideHeader />
        {:else}
          <Card />
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
    padding: 18px 22px 16px;
    border-bottom: 1px solid var(--line-1);
  }

  /* A hint of the map through the panel, Apple-style */
  @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .spot-panel {
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .spot-panel {
      background: var(--surface-1);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }


  .panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 22px 32px;
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

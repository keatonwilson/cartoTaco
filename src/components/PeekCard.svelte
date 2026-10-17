<script>
  // Peek card: a small summary that floats over the pin under the cursor (or
  // the one tapped, on touch tablets). Short enough to always fit beside the
  // pin; "Open card" hands off to the side panel, morphing the name across
  // where view transitions are supported.
  import { onDestroy, tick } from 'svelte';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import { peekSite } from '$lib/uiStore';
  import { selectedSite } from '$lib/stores';
  import { getOpenStatus, minuteClock } from '$lib/hours';
  import { openSpot, cancelPeekHide, schedulePeekHide, spotPanelWidth } from '$lib/mapping';
  import { trailModeActive, trailStops, addStop, removeStop } from '$lib/trailStore';
  import { isMobile, screenWidth } from '$lib/deviceDetection';

  /** Mapbox GL map instance */
  export let map;

  const TYPE_LABELS = { 'Brick and Mortar': 'Restaurant', Stand: 'Stand', Truck: 'Food truck' };
  const TORTILLA_LABELS = { corn: 'corn', flour: 'flour', both: 'corn & flour' };

  // What sets the spot apart, all from processedTacoData (nothing stored):
  // its first listed specialty (items come before proteins and salsas), then
  // salsa count and tortillas as one short facts line
  function quickFacts(s) {
    const facts = [];
    if (s.salsaCount) facts.push(`${s.salsaCount} ${s.salsaCount === 1 ? 'salsa' : 'salsas'}`);
    const tortilla = TORTILLA_LABELS[String(s.tortillaType || '').toLowerCase()];
    if (tortilla) {
      const text = `${s.handmadeTortilla ? 'handmade ' : ''}${tortilla} tortillas`;
      facts.push(text.charAt(0).toUpperCase() + text.slice(1));
    }
    return facts;
  }

  $: peek = $isMobile ? null : $peekSite;
  $: site = peek?.site;
  $: status = site ? getOpenStatus(site.startHours || [], site.endHours || [], $minuteClock) : null;
  $: knownFor = site?.specialties?.find((s) => s?.name)?.name || null;
  $: facts = site ? quickFacts(site) : [];
  $: proteins = (site?.topFiveProteinItems || [])
    .map((name, i) => ({ name, value: site.topFiveProteinValues?.[i] || 0 }))
    .filter((p) => p.value > 0)
    .slice(0, 3);
  $: stopIndex = site ? $trailStops.findIndex((s) => s.est_id === site.est_id) : -1;

  // ── Placement: above the pin, flipped below near the top edge, kept clear
  // of the side panel and the map's edges ──
  let el;
  let x = 0;
  let y = 0;
  let below = false;
  const GAP = 16;

  function headerHeight() {
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
    return Number.isFinite(h) ? h : 0;
  }

  function place() {
    if (!map || !peek || !el) return;
    const p = map.project(peek.lngLat);
    const { clientWidth } = map.getContainer();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = $selectedSite ? spotPanelWidth($screenWidth) : 0;
    below = p.y - h - GAP < headerHeight() + 8;
    x = Math.min(Math.max(p.x, left + w / 2 + 8), clientWidth - w / 2 - 8);
    y = p.y;
  }

  $: if (peek) tick().then(place);

  // Follow the pin while the map moves under it
  let following = false;
  $: if (map && peek && !following) {
    map.on('move', place);
    following = true;
  } else if (map && !peek && following) {
    map.off('move', place);
    following = false;
  }
  onDestroy(() => map?.off('move', place));

  // Touch fires pointerleave right after a tap; only a mouse leaving means "gone"
  function onPointerLeave(e) {
    if (e.pointerType === 'mouse') schedulePeekHide();
  }

  function openCard() {
    if (!site) return;
    const go = () => openSpot(map, site);
    const morph =
      typeof document !== 'undefined' &&
      document.startViewTransition &&
      !$selectedSite &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!morph) {
      go();
      return;
    }
    const root = document.documentElement;
    root.classList.add('spot-morph');
    const transition = document.startViewTransition(async () => {
      go();
      await tick();
    });
    transition.finished.finally(() => root.classList.remove('spot-morph'));
  }

  function toggleStop() {
    if (!site) return;
    stopIndex >= 0 ? removeStop(site.est_id) : addStop(site);
  }
</script>

{#if site}
  <div
    class="peek"
    class:below
    class:pending={site.isPending}
    class:closed={site.isClosed}
    style="left:{x}px; top:{y}px"
    bind:this={el}
    on:pointerenter={cancelPeekHide}
    on:pointerleave={onPointerLeave}
    role="dialog"
    aria-label="{site.name} preview"
  >
    {#key site.est_id}
      <div class="peek-inner">
        <p class="kicker">
          {#if site.isClosed}
            <span>✕ Closed</span>
          {:else if site.isPending}
            <span>◌ Pending</span>
          {:else if status}
            <span class="status-dot" data-state={status.state}></span>
            <span>{status.label}</span>
          {/if}
          {#if TYPE_LABELS[site.type] || site.type}
            <span class="sep">·</span><span>{TYPE_LABELS[site.type] || site.type}</span>
          {/if}
        </p>

        <h3 class="name" style:view-transition-name={$selectedSite ? null : 'spot-title'}>
          {site.name}
        </h3>

        {#if site.isPending}
          <p class="note">Found online, not visited yet.</p>
        {:else if site.isClosed}
          <p class="note">Permanently closed. The card keeps what we recorded.</p>
        {:else}
          {#if knownFor}
            <p class="known-for"><span class="label">Known for</span> {knownFor}</p>
          {/if}
          {#if facts.length}
            <p class="facts">{facts.join(' · ')}</p>
          {/if}
          {#if proteins.length}
            <div class="chips">
              {#each proteins as p}
                <span class="chip">{p.name}</span>
              {/each}
            </div>
          {/if}
        {/if}

        <div class="foot">
          {#if $trailModeActive}
            <button type="button" class="primary" on:click={toggleStop}>
              {stopIndex >= 0 ? `Remove stop ${stopIndex + 1}` : `Add as stop ${$trailStops.length + 1}`}
            </button>
            <button type="button" class="link" on:click={openCard}>Details</button>
          {:else}
            <button type="button" class="primary" on:click={openCard}>
              Open card <ArrowRight size={13} weight="bold" />
            </button>
          {/if}
        </div>
      </div>
    {/key}
  </div>
{/if}

<style>
  .peek {
    position: absolute;
    z-index: 60;
    width: 264px;
    transform: translate(-50%, calc(-100% - 16px));
    pointer-events: auto;
  }

  .peek.below {
    transform: translate(-50%, 16px);
  }

  .peek-inner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--line-1);
    background: var(--surface-1);
    box-shadow: 0 12px 32px -14px rgba(0, 0, 0, 0.45);
    animation: peek-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
    transform-origin: 50% 100%;
  }

  .peek.below .peek-inner {
    transform-origin: 50% 0;
  }

  .peek.pending .peek-inner {
    border: 1.5px dashed var(--pending);
  }

  .peek.closed .peek-inner {
    border: 1.5px dashed var(--closed);
  }

  @keyframes peek-in {
    from {
      opacity: 0;
      transform: translateY(4px) scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .peek-inner {
      animation: none;
    }
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 0;
    min-width: 0;
    font: 600 10.5px/1.3 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
  }

  .sep {
    color: var(--ink-3);
  }

  .status-dot {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--error);
  }
  .status-dot[data-state='open'] {
    background: var(--success);
  }
  .status-dot[data-state='closing-soon'] {
    background: var(--warning);
  }
  .status-dot[data-state='unknown'] {
    background: var(--ink-3);
  }

  .name {
    margin: 0;
    font-family: var(--font-serif);
    font-weight: 650;
    font-size: 19px;
    line-height: 1.12;
    font-variation-settings: 'opsz' 36;
    color: var(--ink-1);
    text-wrap: balance;
  }

  .note {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--ink-2);
  }

  .known-for {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.35;
    font-weight: 600;
    color: var(--ink-1);
  }

  .known-for .label {
    display: block;
    margin-bottom: 1px;
    font: 600 10px/1.3 var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .facts {
    margin: 0;
    font-size: 12.5px;
    color: var(--ink-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-3);
    font-size: 11.5px;
    font-weight: 500;
    color: var(--ink-2);
    text-transform: capitalize;
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 2px;
  }

  .primary {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border: none;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font: 600 12px/1.4 var(--font-text);
    cursor: pointer;
  }

  .primary:hover {
    background: var(--accent-hover);
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--ink-2);
    font: 600 12px/1.4 var(--font-text);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .primary:focus-visible,
  .link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>

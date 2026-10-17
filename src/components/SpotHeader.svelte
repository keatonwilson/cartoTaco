<script>
  // The spot card's header, shared by the desktop panel and the mobile sheet:
  // mono kicker, the name in Fraunces with the type icons, today's status and
  // address, then the things people actually do from a card (directions,
  // call, website, favorite, compare) as labelled buttons.
  import { createEventDispatcher, tick } from 'svelte';
  import X from 'phosphor-svelte/lib/X';
  import NavigationArrow from 'phosphor-svelte/lib/NavigationArrow';
  import Phone from 'phosphor-svelte/lib/Phone';
  import Globe from 'phosphor-svelte/lib/Globe';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';
  import FacebookLogo from 'phosphor-svelte/lib/FacebookLogo';
  import FavoriteButton from './FavoriteButton.svelte';
  import IconHighlight from './IconHighlight.svelte';
  import { getOpenStatus, minuteClock } from '$lib/hours';
  import { openDirections } from '$lib/directions';
  import { hasValidCoordinates } from '$lib/stores';
  import {
    comparisonSites,
    comparisonCount,
    addToComparison,
    removeFromComparison
  } from '$lib/comparisonStore.js';

  /** processedSite */
  export let site;
  /** The mobile sheet has its own × in the drag bar */
  export let showClose = true;

  const dispatch = createEventDispatcher();

  const TYPE_LABELS = { 'Brick and Mortar': 'Restaurant', Stand: 'Stand', Truck: 'Food truck' };

  $: region = site.rawData?.descriptions?.region || null;
  $: kicker = [site.isPending ? '◌ Pending vetting' : null, TYPE_LABELS[site.type] || site.type, region]
    .filter(Boolean)
    .join(' · ');
  $: status = getOpenStatus(site.startHours || [], site.endHours || [], $minuteClock);
  $: contact = site.site || {};
  $: phoneHref = contact.phone ? `tel:${String(contact.phone).replace(/\D/g, '')}` : null;
  // Closed spots are a historical record, not a trip to plan
  $: canNavigate = !site.isClosed && hasValidCoordinates(site);

  $: isInComparison = $comparisonSites.some((s) => s.est_id === site.est_id);
  $: comparisonFull = $comparisonCount >= 3 && !isInComparison;

  async function toggleComparison() {
    isInComparison ? removeFromComparison(site.est_id) : addToComparison(site);
    // iOS Safari caches the sheet's scroll layer and won't repaint the
    // button's colour change until a scroll forces a flush; nudge it
    await tick();
    const el = document.querySelector('.sheet-content');
    if (el) {
      const prev = el.scrollTop;
      el.scrollTop = prev + 1;
      requestAnimationFrame(() => (el.scrollTop = prev));
    }
  }
</script>

<header class="spot-head">
  <div class="kicker-row">
    <p class="kicker">{kicker}</p>
    {#if showClose}
      <button type="button" class="close-btn" on:click={() => dispatch('close')} aria-label="Close" title="Close (Esc)">
        <X size={16} weight="bold" />
      </button>
    {/if}
  </div>

  <div class="name-row">
    <h2 class="spot-name">{site.name || 'Unknown Location'}</h2>
    <!-- Restaurant / stand / truck, this spot's type lit -->
    <div class="type-icons">
      <IconHighlight type="siteType" data={site.type || 'unknown'} />
    </div>
  </div>

  <!-- Keep it: favorite and compare, beside today's status (as before) -->
  <div class="status-row">
    <p class="status-line">
      {#if site.isClosed}
        <span class="status" data-state="gone">✕ Permanently closed</span>
      {:else}
        <span class="status" data-state={status.state}><span class="status-dot"></span>{status.label}</span>
      {/if}
      {#if contact.address}
        <span class="address">{contact.address}</span>
      {/if}
    </p>
    <div class="group">
      <FavoriteButton estId={site.est_id} size="sm" />
      {#if !site.isClosed && !site.isPending}
        <button
          type="button"
          class="action compare"
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

  <!-- Go there / get in touch -->
  {#if canNavigate || phoneHref || contact.website || contact.instagram || contact.facebook}
    <div class="group contact">
      {#if canNavigate}
        <button type="button" class="action primary" on:click={() => openDirections(site)}>
          <NavigationArrow size={16} weight="fill" /> Directions
        </button>
      {/if}
      {#if phoneHref}
        <a class="action" href={phoneHref} title="Call {contact.phone}">
          <Phone size={16} weight="bold" /> Call
        </a>
      {/if}
      {#if contact.website}
        <a class="action" href={contact.website} target="_blank" rel="noopener noreferrer">
          <Globe size={16} weight="bold" /> Website
        </a>
      {/if}
      {#if contact.instagram}
        <a
          class="action icon-only"
          href="https://instagram.com/{contact.instagram}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          title="Instagram"
        >
          <InstagramLogo size={18} weight="bold" />
        </a>
      {/if}
      {#if contact.facebook}
        <a
          class="action icon-only"
          href="https://facebook.com/{contact.facebook}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          title="Facebook"
        >
          <FacebookLogo size={18} weight="bold" />
        </a>
      {/if}
    </div>
  {/if}
</header>

<style>
  .spot-head {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kicker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }

  .kicker {
    margin: 0;
    min-width: 0;
    font: 600 12px/1.3 var(--font-mono);
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

  .spot-name {
    margin: 0;
    min-width: 0;
    font-family: var(--font-serif);
    font-weight: 650;
    font-size: 32px;
    line-height: 1.06;
    font-variation-settings: 'opsz' 72;
    letter-spacing: -0.01em;
    color: var(--ink-1);
    text-wrap: balance;
    view-transition-name: spot-title;
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
    width: 32px;
    height: 32px;
  }

  /* The kicker already names the type in words, and a hover tooltip here can
     only land on the name or the action buttons */
  .type-icons :global(.tooltip) {
    display: none;
  }

  .status-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
  }

  .status-line {
    display: flex;
    flex: 1 1 200px;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 12px;
    min-width: 0;
    margin: 0;
    font-size: 15px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 650;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .status-dot {
    width: 9px;
    height: 9px;
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

  .address {
    color: var(--ink-2);
  }

  /* Each group wraps as a unit, so favorite and compare never split up */
  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .group.contact {
    padding-top: 2px;
  }

  .action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--line-2);
    background: var(--surface-1);
    color: var(--ink-1);
    font: 600 14px/1 var(--font-text);
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .action:hover {
    border-color: var(--accent);
  }

  .action.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .action.primary:hover {
    background: var(--accent-hover);
  }

  .action.icon-only {
    width: 36px;
    padding: 0;
    justify-content: center;
  }

  .action.compare {
    border-color: var(--accent);
    color: var(--accent-hover);
  }

  .action.compare.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .action:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .action:focus-visible,
  .close-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Match FavoriteButton to the Compare pill (outranks its own size-sm
     rules). It drops its label to a heart on narrow screens by itself. */
  .spot-head .group :global(.favorite-button.size-sm) {
    height: 36px;
    padding: 0 14px;
    border-width: 1px;
    border-radius: 999px;
    font-size: 14px;
  }

  .close-btn {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
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
</style>

<script>
  import { onMount, tick } from 'svelte';
  import RadarChart from "./RadarChart.svelte";
  import HoursOpen from "./HoursOpen.svelte";
  import SpiceGauge from "./SpiceGauge.svelte";
  import IconHighlight from "./IconHighlight.svelte";
  import SalsaCount from "./SalsaCount.svelte";
  import SpecCarousel from "./SpecCarousel.svelte";
  import SpecCard from "./SpecCard.svelte";
  import ContactInfo from "./ContactInfo.svelte";
  import CollapsibleSection from "./CollapsibleSection.svelte";
  import FavoriteButton from "./FavoriteButton.svelte";
  import VibeVotes from "./VibeVotes.svelte";
  import VibeFingerprint from "./VibeFingerprint.svelte";
  import HandmadeBadge from "./HandmadeBadge.svelte";
  import SalsaLineup from "./SalsaLineup.svelte";
  import ContextStrip from "./ContextStrip.svelte";
  import ClosedBanner from "./ClosedBanner.svelte";
  import { selectedSite, summaryStats, distributionStats, processedTacoData } from "$lib/stores";
  import { radarMax } from "$lib/chartTheme";
  import { isMobile } from "$lib/deviceDetection";
  import {
    comparisonSites,
    comparisonCount,
    addToComparison,
    removeFromComparison
  } from "$lib/comparisonStore.js";

  /** 'sheet' (mobile bottom sheet) or 'panel' (desktop/tablet side panel) */
  export let variant = null;
  $: layout = variant ?? ($isMobile ? 'sheet' : 'panel');

  // Local state
  let showLongDescription = false;
  /** Which radar the panel layout shows */
  let radarView = 'menu';

  // Closed spots keep their recorded data as a historical record, but lose the
  // affordances that assume you might go: vibe voting, comparison, directions.
  $: isClosed = !!$selectedSite?.isClosed;

  // Comparison state for this card
  $: isInComparison = $comparisonSites.some(s => s.est_id === $selectedSite?.est_id);
  $: comparisonFull = $comparisonCount >= 3 && !isInComparison;

  // City-percentile context for the heat ladder and salsa bullet
  $: heatPercentile = $selectedSite
    ? $distributionStats.get($selectedSite.est_id)?.heatPercentile ?? null
    : null;
  $: salsaPercentile = $selectedSite
    ? $distributionStats.get($selectedSite.est_id)?.salsaPercentile ?? null
    : null;

  // City heat distribution for the mobile context strip
  $: cityHeats = $processedTacoData.map((s) => s.heatOverall || 0);

  // Radar scales fit this spot's own values so the polygon fills the plot;
  // cross-spot comparison happens on /compare, which shares a scale there
  $: menuRadarMax = radarMax($selectedSite?.topFiveMenuValues);
  $: proteinRadarMax = radarMax($selectedSite?.topFiveProteinValues);

  async function toggleComparison() {
    if (!$selectedSite) return;
    if (isInComparison) {
      removeFromComparison($selectedSite.est_id);
    } else {
      addToComparison($selectedSite);
    }
    // iOS Safari caches the scroll container's GPU texture and won't repaint
    // a text-color change until a scroll event forces a flush. Nudging
    // scrollTop by 1px and back directly mimics what the user manually does
    // to make the white text appear, guaranteeing a repaint.
    await tick();
    if (typeof document !== 'undefined') {
      const el = document.querySelector('.sheet-content');
      if (el) {
        const prev = el.scrollTop;
        el.scrollTop = prev + 1;
        requestAnimationFrame(() => { el.scrollTop = prev; });
      }
    }
  }
  let errorState = false;
  let errorMessage = "Unable to display data";

  // Toggle long description
  function toggleLongDescription() {
    showLongDescription = !showLongDescription;
  }
</script>

{#if !$selectedSite}
  <div id="error-content">
    <p>No location selected</p>
  </div>
{:else if errorState}
  <div id="error-content">
    <p>{errorMessage}</p>
  </div>
{:else}
  {#if layout === 'sheet'}
    <!-- ========== MOBILE LAYOUT (unchanged) ========== -->
    <div id="popup-content">
      <div class="left-panel">
        {#if isClosed}
          <ClosedBanner closedAt={$selectedSite.closedAt} />
        {/if}
        <div class="header-section">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {$selectedSite.name || 'Unknown Location'}
          </h2>
          <div class="header-actions">
            <FavoriteButton estId={$selectedSite.est_id} size="sm" />
            {#if !isClosed}
              <button
                class="compare-btn"
                class:compare-active={isInComparison}
                disabled={!isInComparison && comparisonFull}
                on:click={toggleComparison}
                title={isInComparison ? 'Remove from comparison' : comparisonFull ? 'Max 3 spots' : 'Add to comparison'}
              >
                {isInComparison ? '− Compare' : '+ Compare'}
              </button>
            {/if}
          </div>
        </div>
        <HoursOpen
          startHours={$selectedSite.startHours || {}}
          endHours={$selectedSite.endHours || {}}
        />
        <ContactInfo
          showDirections={!isClosed}
          phone={$selectedSite.site?.phone}
          website={$selectedSite.site?.website}
          instagram={$selectedSite.site?.instagram}
          facebook={$selectedSite.site?.facebook}
          address={$selectedSite.site?.address}
          latitude={$selectedSite.latitude}
          longitude={$selectedSite.longitude}
          name={$selectedSite.name || 'Taco Location'}
        />
        <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Type</h2>
        <IconHighlight type="siteType" data={$selectedSite.type || 'unknown'} />
        <div class="description">
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Description</h2>
          <p class="dark:text-gray-300">{$selectedSite.shortDescription || 'No description available'}</p>
          <div class="long-description" class:visible={showLongDescription}>
            <p class="dark:text-gray-300">{$selectedSite.longDescription || 'No detailed description available'}</p>
          </div>
          <button
            class="expand-button"
            on:click={toggleLongDescription}
            aria-expanded={showLongDescription}
            aria-label={showLongDescription ? "Show less description" : "Read more description"}
          >
            {showLongDescription ? "Show less" : "Read more"}
          </button>
        </div>
        {#if !isClosed}
          <div class="vibe-section">
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Vibe Check</h2>
            <p class="vibe-subtitle">Tap any chip to vote on what this spot does well. Your vote, plus everyone else's, builds a vibe fingerprint — no stars, no essays.</p>
            <VibeVotes estId={$selectedSite.est_id} />
            <div class="vibe-fingerprint-wrap">
              <VibeFingerprint estId={$selectedSite.est_id} />
            </div>
          </div>
        {/if}
        <CollapsibleSection title="Menu Summary" defaultOpen={false}>
          <div class="radar-chart-container">
            <RadarChart
              labels={$selectedSite.topFiveMenuItems || []}
              data={$selectedSite.topFiveMenuValues || []}
              max={menuRadarMax}
            />
          </div>
        </CollapsibleSection>
      </div>
      <div class="right-panel" id="chart">
        <CollapsibleSection title="Protein" defaultOpen={false}>
          <div class="protein-chart-container">
            <RadarChart
              labels={$selectedSite.topFiveProteinItems || []}
              data={$selectedSite.topFiveProteinValues || []}
              max={proteinRadarMax}
            />
          </div>
          {#if $selectedSite.proteinStyles && Object.keys($selectedSite.proteinStyles).length > 0}
            <div class="protein-styles">
              {#each Object.entries($selectedSite.proteinStyles) as [protein, styles]}
                <div class="protein-style-row">
                  <span class="protein-label">{protein}</span>
                  <div class="style-chips">
                    {#each styles as style}
                      <span class="style-chip">{style}</span>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </CollapsibleSection>

        <CollapsibleSection title="Spiciness & Details" defaultOpen={true}>
          <div class="right-box">
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1" id="spicy-label">Spiciness</h2>
            <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} percentile={heatPercentile} />
            <ContextStrip
              values={cityHeats}
              value={$selectedSite.heatOverall || 0}
              min={0}
              max={10}
              label="Every Tucson spot's heat — this one highlighted"
            />
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Tortilla Type</h2>
            <div class="tortilla-row">
              <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
              {#if $selectedSite.handmadeTortilla}
                <HandmadeBadge />
              {/if}
            </div>
          </div>
          <div class='salsa-container'>
            <SalsaCount
              value={$selectedSite.salsaCount || 0}
              meanValue={$summaryStats.avgSalsaNum || 0}
              maxValue={$summaryStats.maxSalsaNum || 0}
              percentile={salsaPercentile}
            />
          </div>
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Salsa Lineup</h2>
          <SalsaLineup
            salsaVarieties={$selectedSite.salsaVarieties || []}
            otherSalsas={$selectedSite.otherSalsas || []}
          />
        </CollapsibleSection>

        <div class="specialties-section">
          <CollapsibleSection title="Specialties" defaultOpen={true}>
            {#if $selectedSite.specialties && $selectedSite.specialties.length > 0}
              <SpecCarousel specialties={$selectedSite.specialties} />
            {:else}
              <p class="text-sm text-gray-500 dark:text-gray-400 italic">No specialty information available for this location.</p>
            {/if}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  {:else}
    <!-- ========== PANEL LAYOUT (desktop/tablet side panel) ==========
         One reading column. The name and actions live in SpotPanel's sticky
         header, so this is just the body. Each section is a labelled band
         split by a hairline; --i staggers the entrance. -->
    <div id="popup-content" class="panel-layout">
      {#if isClosed}
        <ClosedBanner closedAt={$selectedSite.closedAt} />
      {/if}

      <section class="panel-section" style="--i:0">
        <p class="panel-lede">{$selectedSite.shortDescription || 'No description available'}</p>
        {#if $selectedSite.longDescription}
          <div class="long-description" class:visible={showLongDescription}>
            <p class="panel-long">{$selectedSite.longDescription}</p>
          </div>
          <button
            class="expand-button"
            on:click={toggleLongDescription}
            aria-expanded={showLongDescription}
          >
            {showLongDescription ? 'Show less' : 'Read more'}
          </button>
        {/if}
      </section>

      <section class="panel-section" style="--i:1">
        <h3 class="panel-label">Hours</h3>
        <HoursOpen
          showTitle={false}
          showStatus={false}
          startHours={$selectedSite.startHours || {}}
          endHours={$selectedSite.endHours || {}}
        />
        <div class="panel-contact">
          <ContactInfo
            compact={true}
            showDirections={!isClosed}
            phone={$selectedSite.site?.phone}
            website={$selectedSite.site?.website}
            instagram={$selectedSite.site?.instagram}
            facebook={$selectedSite.site?.facebook}
            address={$selectedSite.site?.address}
            latitude={$selectedSite.latitude}
            longitude={$selectedSite.longitude}
            name={$selectedSite.name || 'Taco Location'}
          />
        </div>
      </section>

      <section class="panel-section" style="--i:2">
        <h3 class="panel-label">Heat</h3>
        <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} percentile={heatPercentile} />
        <ContextStrip
          values={cityHeats}
          value={$selectedSite.heatOverall || 0}
          min={0}
          max={10}
          label="Every Tucson spot's heat — this one highlighted"
        />
      </section>

      <section class="panel-section" style="--i:3">
        <h3 class="panel-label">Salsas</h3>
        <SalsaCount
          value={$selectedSite.salsaCount || 0}
          meanValue={$summaryStats.avgSalsaNum || 0}
          maxValue={$summaryStats.maxSalsaNum || 0}
          percentile={salsaPercentile}
        />
        <SalsaLineup
          salsaVarieties={$selectedSite.salsaVarieties || []}
          otherSalsas={$selectedSite.otherSalsas || []}
        />
      </section>

      <section class="panel-section" style="--i:4">
        <h3 class="panel-label">Tortilla</h3>
        <div class="tortilla-row">
          <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
          {#if $selectedSite.handmadeTortilla}
            <HandmadeBadge />
          {/if}
        </div>
      </section>

      {#if !isClosed}
        <section class="panel-section" style="--i:5">
          <h3 class="panel-label">Vibe check</h3>
          <VibeVotes estId={$selectedSite.est_id} compact={true} />
          <div class="vibe-fingerprint-wrap">
            <VibeFingerprint estId={$selectedSite.est_id} />
          </div>
        </section>
      {/if}

      <!-- One radar at a time behind a toggle: side by side they'd be too
           narrow for their axis labels at panel width -->
      <section class="panel-section" style="--i:6">
        <div class="panel-label-row">
          <h3 class="panel-label">What they serve</h3>
          <div class="radar-toggle" role="group" aria-label="Chart">
            <button type="button" aria-pressed={radarView === 'menu'} on:click={() => (radarView = 'menu')}>Menu</button>
            <button type="button" aria-pressed={radarView === 'protein'} on:click={() => (radarView = 'protein')}>Protein</button>
          </div>
        </div>
        <div class="panel-radar">
          {#if radarView === 'menu'}
            <RadarChart
              labels={$selectedSite.topFiveMenuItems || []}
              data={$selectedSite.topFiveMenuValues || []}
              max={menuRadarMax}
            />
          {:else}
            <RadarChart
              labels={$selectedSite.topFiveProteinItems || []}
              data={$selectedSite.topFiveProteinValues || []}
              max={proteinRadarMax}
            />
          {/if}
        </div>
        {#if radarView === 'protein' && $selectedSite.proteinStyles && Object.keys($selectedSite.proteinStyles).length > 0}
          <div class="protein-styles">
            {#each Object.entries($selectedSite.proteinStyles) as [protein, styles]}
              <div class="protein-style-row">
                <span class="protein-label">{protein}</span>
                <div class="style-chips">
                  {#each styles as style}
                    <span class="style-chip">{style}</span>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section class="panel-section" style="--i:7">
        <h3 class="panel-label">Specialties</h3>
        {#if $selectedSite.specialties && $selectedSite.specialties.length > 0}
          <SpecCarousel specialties={$selectedSite.specialties} />
        {:else}
          <p class="panel-empty">No specialty information for this spot yet.</p>
        {/if}
      </section>
    </div>
  {/if}
{/if}

<style>
  #error-content {
    padding: 20px;
    text-align: center;
    background-color: #ffe6e6;
    border: 1px solid #ffcccc;
    border-radius: 8px;
    margin: 10px;
  }

  :global(.dark) #error-content {
    background-color: #7f1d1d;
    border-color: #991b1b;
    color: #fecaca;
  }

  /* ========== MOBILE STYLES (unchanged) ========== */

  .header-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  @media (min-width: 768px) {
    .header-section {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .header-section h2 {
      margin-bottom: 0;
    }
  }

  #popup-content {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 6px;
  }

  .left-panel,
  .right-panel {
    padding: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    width: 100%;
    background: white;
  }

  :global(.dark) .left-panel,
  :global(.dark) .right-panel {
    background: #1f2937;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .description {
    margin-top: 6px;
    color: #34495e;
    background-color: #ecf0f1;
    padding: 10px 12px;
    border-radius: 8px;
    text-align: left;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    transition: background-color 0.2s;
    font-size: 13px;
    line-height: 1.45;
  }

  :global(.dark) .description {
    background-color: #374151;
    color: #d1d5db;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .long-description {
    display: none;
    margin-top: 6px;
  }

  .long-description.visible {
    display: block;
  }

  .expand-button {
    cursor: pointer;
    color: #FE795D;
    text-decoration: underline;
    display: inline-block;
    padding: 6px 4px;
    margin-top: 2px;
    font-size: 12px;
    transition: color 0.15s ease;
  }

  .expand-button:hover {
    color: #d66548;
  }

  :global(.dark) .expand-button {
    color: #FF9E80;
  }

  :global(.dark) .expand-button:hover {
    color: #FFB28F;
  }

  .protein-chart-container {
    display: flex;
    justify-content: center;
    padding: 2%;
    height: 200px;
  }

  .radar-chart-container {
    display: flex;
    justify-content: center;
    height: 200px;
  }

  .protein-styles {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }

  .protein-style-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .protein-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: capitalize;
    color: var(--accent-hover);
    min-width: 52px;
    flex-shrink: 0;
  }

  :global(.dark) .protein-label {
    color: var(--accent);
  }

  .style-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    color: var(--accent-hover);
    background: var(--accent-soft);
    white-space: nowrap;
  }

  :global(.dark) .style-chip {
    color: var(--accent);
  }

  .salsa-container {
    display: flex;
  }

  .specialties-section {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid lightgray;
    display: flex;
    flex-direction: column;
  }

  .tortilla-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tortilla-row :global(.handmade-badge) {
    margin-top: 0;
  }

  .vibe-section {
    margin-top: 12px;
    margin-bottom: 8px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
  }

  :global(.dark) .vibe-section {
    border-top-color: #374151;
  }

  .vibe-subtitle {
    font-size: 11px;
    line-height: 1.35;
    color: #6b7280;
    margin: 0 0 6px 0;
  }

  .vibe-fingerprint-wrap {
    margin-top: 6px;
  }

  :global(.dark) .vibe-subtitle {
    color: #9ca3af;
  }

  /* ===== Panel layout (desktop/tablet side panel) ===== */
  .panel-layout {
    gap: 0;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 0;
    border-top: 1px solid var(--line-1);
    animation: panel-section-in 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }

  .panel-section:first-of-type {
    border-top: none;
    padding-top: 4px;
  }

  @keyframes panel-section-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-section {
      animation: none;
    }
  }

  /* Mono caps label, the Salsa Atlas kicker voice */
  .panel-label {
    margin: 0;
    font: 600 11px/1.3 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .panel-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .panel-lede {
    margin: 0;
    font-size: 15px;
    line-height: 1.55;
    color: var(--ink-1);
    text-wrap: pretty;
  }

  .panel-long {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-2);
  }

  .panel-layout .expand-button {
    align-self: flex-start;
    margin-top: -4px;
  }

  .panel-contact {
    display: flex;
  }

  .panel-empty {
    margin: 0;
    font-size: 13px;
    color: var(--ink-3);
    font-style: italic;
  }

  .panel-radar {
    height: 240px;
  }

  /* Specialty cards get most of the panel's width, with the next one peeking in */
  .panel-layout :global(.carousel-item) {
    flex-basis: 85%;
  }

  .radar-toggle {
    display: inline-flex;
    padding: 2px;
    border-radius: 999px;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
  }

  .radar-toggle button {
    padding: 3px 10px;
    border: none;
    border-radius: 999px;
    background: transparent;
    font: 600 12px/1.4 var(--font-text);
    color: var(--ink-2);
    cursor: pointer;
  }

  .radar-toggle button[aria-pressed='true'] {
    background: var(--surface-1);
    color: var(--ink-1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }

  .radar-toggle button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  /* Header action groups */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* Compare button */
  .compare-btn {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    flex-shrink: 0;
    padding: 4px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f9fafb;
    color: #374151;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-appearance: none;
    appearance: none;
    /* Always keep button on its own GPU compositing layer so iOS Safari
       repaints it independently of the parent scroll container's cached texture */
    transform: translateZ(0);
  }

  /* Hover only on real pointer devices — touch screens leave :hover sticky
     after a tap, making a just-deselected button look still-active */
  @media (hover: hover) {
    .compare-btn:hover:not(:disabled) {
      border-color: #FE795D;
      color: #FE795D;
    }
  }

  /* Active state uses orange text on light-orange tint instead of white-on-orange.
     This sidesteps an iOS Safari GPU texture cache bug where white text on a
     newly-painted dark background is invisible until a scroll event forces a
     repaint flush. Orange text on a light background remains visible regardless
     of whether iOS repaints the cached scroll layer. */
  .compare-btn.compare-active {
    background: rgba(254, 121, 93, 0.12);
    color: #FE795D;
    border-color: #FE795D;
  }

  .compare-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(.dark) .compare-btn {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  :global(.dark) .compare-btn.compare-active {
    background: rgba(254, 121, 93, 0.18);
    color: #FE795D;
    border-color: #FE795D;
  }
</style>

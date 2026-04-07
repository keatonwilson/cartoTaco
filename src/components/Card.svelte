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
  import { selectedSite, summaryStats } from "$lib/stores";
  import { isMobile } from "$lib/deviceDetection";
  import {
    comparisonSites,
    comparisonCount,
    addToComparison,
    removeFromComparison
  } from "$lib/comparisonStore.js";

  // Local state
  let showLongDescription = false;

  // Comparison state for this card
  $: isInComparison = $comparisonSites.some(s => s.est_id === $selectedSite?.est_id);
  $: comparisonFull = $comparisonCount >= 3 && !isInComparison;

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
  {#if $isMobile}
    <!-- ========== MOBILE LAYOUT (unchanged) ========== -->
    <div id="popup-content">
      <div class="left-panel">
        <div class="header-section">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {$selectedSite.name || 'Unknown Location'}
          </h2>
          <div class="header-actions">
            <FavoriteButton estId={$selectedSite.est_id} size="sm" />
            <button
              class="compare-btn"
              class:compare-active={isInComparison}
              disabled={!isInComparison && comparisonFull}
              on:click={toggleComparison}
              title={isInComparison ? 'Remove from comparison' : comparisonFull ? 'Max 3 spots' : 'Add to comparison'}
            >
              {isInComparison ? '− Compare' : '+ Compare'}
            </button>
          </div>
        </div>
        <HoursOpen
          startHours={$selectedSite.startHours || {}}
          endHours={$selectedSite.endHours || {}}
        />
        <ContactInfo
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
        <CollapsibleSection title="Menu Summary" defaultOpen={false}>
          <div class="radar-chart-container">
            <RadarChart
              labels={$selectedSite.topFiveMenuItems || []}
              data={$selectedSite.topFiveMenuValues || []}
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
            <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} />
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Tortilla Type</h2>
            <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
          </div>
          <div class='salsa-container'>
            <SalsaCount
              value={$selectedSite.salsaCount || 0}
              meanValue={$summaryStats.avgSalsaNum || 0}
              maxValue={$summaryStats.maxSalsaNum || 0}
            />
          </div>
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
    <!-- ========== DESKTOP LAYOUT (compact, no-scroll) ========== -->
    <div id="popup-content" class="desktop-layout">
      <!-- Row 1: Header bar -->
      <div class="desktop-header">
        <div class="desktop-header-left">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {$selectedSite.name || 'Unknown Location'}
          </h2>
          <span class="type-chip">
            {$selectedSite.type === 'Brick and Mortar' ? 'Restaurant' : $selectedSite.type === 'Truck' ? 'Food Truck' : $selectedSite.type || 'Unknown'}
          </span>
        </div>
        <div class="desktop-header-actions">
          <FavoriteButton estId={$selectedSite.est_id} size="sm" />
          <button
            class="compare-btn"
            class:compare-active={isInComparison}
            disabled={!isInComparison && comparisonFull}
            on:click={toggleComparison}
            title={isInComparison ? 'Remove from comparison' : comparisonFull ? 'Max 3 spots' : 'Add to comparison'}
          >
            {isInComparison ? '− Compare' : '+ Compare'}
          </button>
        </div>
      </div>

      <!-- Row 2: Description (short, with expand) + Hours/Contact collapsible -->
      <div class="desktop-info-row">
        <div class="description desktop-description">
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
        <div class="desktop-details-collapsible">
          <CollapsibleSection title="Hours & Contact" defaultOpen={false}>
            <HoursOpen
              startHours={$selectedSite.startHours || {}}
              endHours={$selectedSite.endHours || {}}
            />
            <ContactInfo
              phone={$selectedSite.site?.phone}
              website={$selectedSite.site?.website}
              instagram={$selectedSite.site?.instagram}
              facebook={$selectedSite.site?.facebook}
              address={$selectedSite.site?.address}
              latitude={$selectedSite.latitude}
              longitude={$selectedSite.longitude}
              name={$selectedSite.name || 'Taco Location'}
            />
          </CollapsibleSection>
        </div>
      </div>

      <!-- Row 3: Two radar charts side by side -->
      <div class="desktop-charts-row">
        <div class="desktop-chart-col">
          <h2 class="text-xs font-semibold text-gray-800 dark:text-gray-100 text-center">Menu</h2>
          <div class="desktop-radar-container">
            <RadarChart
              labels={$selectedSite.topFiveMenuItems || []}
              data={$selectedSite.topFiveMenuValues || []}
            />
          </div>
        </div>
        <div class="desktop-chart-col">
          <h2 class="text-xs font-semibold text-gray-800 dark:text-gray-100 text-center">Protein</h2>
          <div class="desktop-radar-container">
            <RadarChart
              labels={$selectedSite.topFiveProteinItems || []}
              data={$selectedSite.topFiveProteinValues || []}
            />
          </div>
          {#if $selectedSite.proteinStyles && Object.keys($selectedSite.proteinStyles).length > 0}
            <div class="protein-styles protein-styles-compact">
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
        </div>
      </div>

      <!-- Row 4: Spice + Tortilla + Salsa in one compact strip -->
      <div class="desktop-stats-row">
        <div class="desktop-stat-item">
          <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} />
        </div>
        <div class="desktop-stat-item desktop-tortilla-item">
          <h2 class="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-1">Tortilla</h2>
          <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
        </div>
        <div class="desktop-stat-item desktop-salsa-item">
          <SalsaCount
            value={$selectedSite.salsaCount || 0}
            meanValue={$summaryStats.avgSalsaNum || 0}
            maxValue={$summaryStats.maxSalsaNum || 0}
          />
        </div>
      </div>

      <!-- Row 5: Specialties -->
      <div class="desktop-specialties">
        <h2 class="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-1">Specialties</h2>
        {#if $selectedSite.specialties && $selectedSite.specialties.length > 0}
          <SpecCarousel specialties={$selectedSite.specialties} />
        {:else}
          <p class="text-sm text-gray-500 italic">No specialty information available for this location.</p>
        {/if}
      </div>
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
    color: blue;
    text-decoration: underline;
    display: inline-block;
    padding: 6px 4px;
    margin-top: 2px;
    font-size: 12px;
  }

  :global(.dark) .expand-button {
    color: #60a5fa;
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
    color: #FF9800;
    min-width: 52px;
    flex-shrink: 0;
  }

  :global(.dark) .protein-label {
    color: #FFB74D;
  }

  .style-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid #FF9800;
    color: #FF9800;
    background: rgba(255, 152, 0, 0.08);
    white-space: nowrap;
  }

  :global(.dark) .style-chip {
    background: rgba(255, 152, 0, 0.15);
    color: #FFB74D;
    border-color: #FFB74D;
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

  /* ========== DESKTOP LAYOUT STYLES ========== */

  .desktop-layout {
    gap: 4px;
  }

  /* Row 1: Header — right padding avoids overlap with popup close button */
  .desktop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 4px 40px 4px 0;
  }

  .desktop-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .desktop-header-left h2 {
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .type-chip {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 500;
    padding: 2px 9px;
    border-radius: 10px;
    background: rgba(249, 115, 22, 0.1);
    color: #c2410c;
    border: 1px solid rgba(249, 115, 22, 0.25);
    white-space: nowrap;
    flex-shrink: 0;
  }

  :global(.dark) .type-chip {
    background: rgba(249, 115, 22, 0.15);
    color: #fb923c;
    border-color: rgba(249, 115, 22, 0.3);
  }

  /* Row 2: Description + Hours/Contact collapsible */
  .desktop-info-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .desktop-description {
    flex: 1;
    margin-top: 0;
  }

  .desktop-details-collapsible {
    flex: 1;
  }

  /* Row 3: Two radar charts side by side */
  .desktop-charts-row {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .desktop-chart-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .desktop-radar-container {
    display: flex;
    justify-content: center;
    width: 100%;
    height: 220px;
    position: relative;
    overflow: visible;
  }

  .protein-styles-compact {
    gap: 3px;
    padding: 2px 0;
  }

  .protein-styles-compact .protein-label {
    font-size: 10px;
    min-width: 44px;
  }

  .protein-styles-compact .style-chip {
    font-size: 10px;
    padding: 1px 6px;
  }

  /* Row 4: Spice + Tortilla + Salsa strip */
  .desktop-stats-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: #f9fafb;
    border-radius: 6px;
  }

  :global(.dark) .desktop-stats-row {
    background: #1f2937;
  }

  .desktop-stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }

  .desktop-stat-item :global(.gauge-container) {
    width: 64px !important;
    height: 64px !important;
    max-width: 64px !important;
    max-height: 64px !important;
  }

  .desktop-stat-item :global(.gauge-wrapper) {
    gap: 0;
  }

  .desktop-stat-item :global(.spice-description) {
    font-size: 11px;
    margin-top: -2px;
  }

  .desktop-stat-item :global(.spice-explanation) {
    display: none;
  }

  .desktop-tortilla-item :global(.icons) {
    margin: 0;
    gap: 8px;
  }

  .desktop-tortilla-item :global(.tortilla-icon) {
    width: 28px;
    height: 28px;
    max-width: 28px;
    max-height: 28px;
  }

  .desktop-salsa-item :global(.chart-container) {
    max-height: 50px;
  }

  .desktop-salsa-item :global(.salsa-explanation) {
    display: none;
  }

  /* Row 5: Specialties */
  .desktop-specialties {
    padding-top: 4px;
    border-top: 1px solid lightgray;
  }

  :global(.dark) .desktop-specialties {
    border-top-color: #374151;
  }

  /* Header action groups */
  .header-actions,
  .desktop-header-actions {
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

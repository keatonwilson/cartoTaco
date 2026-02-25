<script>
  import { onMount } from 'svelte';
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

  // Local state
  let showLongDescription = false;
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
  <div id="popup-content">
    <div class="left-panel">
      <div class="header-section">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {$selectedSite.name || 'Unknown Location'}
        </h2>
        <FavoriteButton estId={$selectedSite.est_id} size="sm" />
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
      {#if $isMobile}
        <CollapsibleSection title="Menu Summary" defaultOpen={false}>
          <div class="radar-chart-container">
            <RadarChart
              labels={$selectedSite.topFiveMenuItems || []}
              data={$selectedSite.topFiveMenuValues || []}
            />
          </div>
        </CollapsibleSection>
      {:else}
        <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Menu Summary</h2>
        <div class="radar-chart-container">
          <RadarChart
            labels={$selectedSite.topFiveMenuItems || []}
            data={$selectedSite.topFiveMenuValues || []}
          />
        </div>
      {/if}
    </div>
    <div class="right-panel" id="chart">
      {#if $isMobile}
        <CollapsibleSection title="Protein Chart" defaultOpen={false}>
          <div class="protein-chart-container">
            <RadarChart
              labels={$selectedSite.topFiveProteinItems || []}
              data={$selectedSite.topFiveProteinValues || []}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Spiciness & Details" defaultOpen={true}>
          <div class="right-box">
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1" id="spicy-label">Spiciness</h2>
            <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} />
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Tortilla Type</h2>
            <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
          </div>
        </CollapsibleSection>
      {:else}
        <div class="top-row">
          <div class="protein-chart-container">
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Protein</h2>
            <RadarChart
              labels={$selectedSite.topFiveProteinItems || []}
              data={$selectedSite.topFiveProteinValues || []}
            />
          </div>
          <div class="right-box">
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1" id="spicy-label">Spiciness</h2>
            <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} />
            <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 my-1">Tortilla Type</h2>
            <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
          </div>
        </div>
      {/if}
      <div class='salsa-container'>
        <SalsaCount 
          value={$selectedSite.salsaCount || 0} 
          meanValue={$summaryStats.avgSalsaNum || 0} 
          maxValue={$summaryStats.maxSalsaNum || 0} 
        />
      </div>
      
      <!-- Specialty Items Section -->
      <div class="specialties-section">
        {#if $isMobile}
          <CollapsibleSection title="Specialties" defaultOpen={true}>
            {#if $selectedSite.specialties && $selectedSite.specialties.length > 0}
              <SpecCarousel specialties={$selectedSite.specialties} />
            {:else}
              <p class="text-sm text-gray-500 dark:text-gray-400 italic">No specialty information available for this location.</p>
            {/if}
          </CollapsibleSection>
        {:else}
          <!-- Desktop: Also use carousel -->
          <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Specialties</h2>
          {#if $selectedSite.specialties && $selectedSite.specialties.length > 0}
            <SpecCarousel specialties={$selectedSite.specialties} />
          {:else}
            <p class="text-sm text-gray-500 italic">No specialty information available for this location.</p>
          {/if}
        {/if}
      </div>
    </div>
  </div>
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

  /* Header section with title and favorite button */
  .header-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  /* Tablet & Desktop: Side-by-side layout */
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

  /* Mobile-first: Single column vertical stack */
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

  /* Tablet: 50/50 split */
  @media (min-width: 768px) {
    #popup-content {
      flex-direction: row;
      gap: 8px;
    }

    .left-panel {
      width: 50%;
    }

    .right-panel {
      width: 50%;
    }
  }

  /* Desktop: 42/58 split */
  @media (min-width: 1024px) {
    .left-panel {
      width: 42%;
    }

    .right-panel {
      width: 58%;
    }
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

  /* Mobile: Stack protein chart and right-box vertically */
  .top-row {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-bottom: 1px solid lightgray;
  }

  .protein-chart-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    padding: 2%;
  }

  .right-box {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 6px;
    padding-bottom: 10px;
    gap: 8px;
  }

  /* Tablet & Desktop: Horizontal layout for top-row */
  @media (min-width: 768px) {
    .top-row {
      flex-direction: row;
      max-height: 40%;
      align-items: flex-start;
    }

    .protein-chart-container {
      width: 65%;
      justify-content: flex-start;
    }

    .right-box {
      width: 35%;
      align-items: stretch;
      justify-content: start;
      gap: 0;
    }
  }

  .radar-chart-container {
    display: flex;
    justify-content: center;
    max-height: 220px;
  }

  /* Larger radar charts on tablet/desktop */
  @media (min-width: 768px) {
    .radar-chart-container {
      max-height: 280px;
    }
  }

  .salsa-container {
    display: flex;
  }

  .specialties-section {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid lightgray;
    min-height: 200px;
    display: flex;
    flex-direction: column;
  }

  /* Desktop: Slightly more height */
  @media (min-width: 1024px) {
    .specialties-section {
      min-height: 240px;
    }
  }

  /* Heading stays at top */
  .specialties-section h2 {
    flex-shrink: 0;
  }

  /* Carousel wrapper grows and centers content */
  .specialties-section :global(.carousel-wrapper) {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

</style>

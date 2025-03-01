<script>
  import RadarChart from "./RadarChart.svelte";
  import HoursOpen from "./HoursOpen.svelte";
  import SpiceGauge from "./SpiceGauge.svelte";
  import IconHighlight from "./IconHighlight.svelte";
  import SalsaCount from "./SalsaCount.svelte";
  import SpecCarousel from "./SpecCarousel.svelte";
  import SpecCard from "./SpecCard.svelte";
  import { selectedSite, summaryStats, specialtiesBySite } from "$lib/stores";

  // Use the site ID to find the site in the selectedSite store
  export let siteId = null;
  
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
      <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        {$selectedSite.name || 'Unknown Location'}
      </h2>
      <HoursOpen 
        startHours={$selectedSite.startHours || {}} 
        endHours={$selectedSite.endHours || {}} 
      />
      <h2 class="text-m font-semibold text-gray-800 my-2">Type</h2>
      <IconHighlight type="siteType" data={$selectedSite.type || 'unknown'} />
      <div class="description">
        <h2 class="text-m font-semibold text-gray-800 my-2">Description</h2>
        <p>{$selectedSite.shortDescription || 'No description available'}</p>
        <div class="long-description" class:visible={showLongDescription}>
          <p>{$selectedSite.longDescription || 'No detailed description available'}</p>
        </div>
        <span class="expand-button" on:click={toggleLongDescription}>
          {showLongDescription ? "Show less" : "Read more"}
        </span>
      </div>
      <h2 class="text-m font-semibold text-gray-800 my-2">Menu Summary</h2>
      <div class="radar-chart-container">
        <RadarChart 
          labels={$selectedSite.topFiveMenuItems || []} 
          data={$selectedSite.topFiveMenuValues || []} 
        />
      </div>
    </div>
    <div class="right-panel" id="chart">
      <div class="top-row">
        <div class="protein-chart-container">
          <h2 class="text-m font-semibold text-gray-800 my-2">Protein</h2>
          <RadarChart 
            labels={$selectedSite.topFiveProteinItems || []} 
            data={$selectedSite.topFiveProteinValues || []} 
          />
        </div>
        <div class="right-box">
          <h2 class="text-m font-semibold text-gray-800" id="spicy-label">Spiciness</h2>
          <SpiceGauge spiceValue={$selectedSite.heatOverall || 0} />
          <h2 class="text-m font-semibold text-gray-800 my-2">Tortilla Type</h2>
          <IconHighlight type="tortilla" data={$selectedSite.tortillaType || 'unknown'} />
        </div>
      </div>
      <div class='salsa-container'>
        <SalsaCount 
          value={$selectedSite.salsaCount || 0} 
          meanValue={$summaryStats.avgSalsaNum || 0} 
          maxValue={$summaryStats.maxSalsaNum || 0} 
        />
      </div>
      
      <!-- Specialty Items Section -->
      <div class="specialties-section">
        <h2 class="text-lg font-semibold text-gray-800 my-2">Specialties</h2>
        
        {#if $specialtiesBySite && $specialtiesBySite.has($selectedSite.est_id)}
          <div class="specialties-container">
            <!-- Item Specialties -->
            {#if $specialtiesBySite.get($selectedSite.est_id).itemSpecs.length > 0}
              <div class="specialty-category">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Signature Items</h3>
                <div class="specialty-cards">
                  {#each $specialtiesBySite.get($selectedSite.est_id).itemSpecs as itemSpec}
                    <SpecCard 
                      itemDescrip={itemSpec.description || ''} 
                      itemName={itemSpec.name || ''} 
                      cardType='Item'
                    />
                  {/each}
                </div>
              </div>
            {/if}
            
            <!-- Protein Specialties -->
            {#if $specialtiesBySite.get($selectedSite.est_id).proteinSpecs.length > 0}
              <div class="specialty-category">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Signature Proteins</h3>
                <div class="specialty-cards">
                  {#each $specialtiesBySite.get($selectedSite.est_id).proteinSpecs as proteinSpec}
                    <SpecCard 
                      itemDescrip={proteinSpec.description || ''} 
                      itemName={proteinSpec.name || ''} 
                      cardType='Protein'
                    />
                  {/each}
                </div>
              </div>
            {/if}
            
            <!-- Salsa Specialties -->
            {#if $specialtiesBySite.get($selectedSite.est_id).salsaSpecs.length > 0}
              <div class="specialty-category">
                <h3 class="text-sm font-medium text-gray-600 mb-2">Signature Salsas</h3>
                <div class="specialty-cards">
                  {#each $specialtiesBySite.get($selectedSite.est_id).salsaSpecs as salsaSpec}
                    <SpecCard 
                      itemDescrip={salsaSpec.description || ''} 
                      itemName={salsaSpec.name || ''} 
                      cardType='Salsa'
                    />
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <!-- Fallback to message if no specialty data exists -->
          <p class="text-sm text-gray-500 italic">No specialty information available for this location.</p>
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

  #popup-content {
    display: flex;
    width: 100%;
    gap: 10px;
  }

  .left-panel,
  .right-panel {
    padding: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    border-radius: 2%;
  }

  .left-panel {
    width: 40%;
  }

  .right-panel {
    width: 60%;
  }

  .description {
    margin-top: 10px;
    color: #34495e;
    background-color: #ecf0f1;
    padding: 20px;
    border-radius: 10px;
    text-align: left;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: background-color 0.2s;
  }

  .long-description {
    display: none;
    margin-top: 10px;
  }

  .long-description.visible {
    display: block;
  }

  .expand-button {
    cursor: pointer;
    color: blue;
    text-decoration: underline;
  }

  .top-row {
    display: flex;
    width: 100%;
    max-height: 40%;
    border-bottom: 1px solid lightgray;
  }

  .protein-chart-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 65%;
    padding: 2%;
  }

  .right-box {
    width: 35%;
    display: flex;
    flex-direction: column;
    justify-content: start;
    padding-top: 0px;
  }

  .radar-chart-container {
    display: flex;
    justify-content: center;
    max-height: 500px;
  }

  .salsa-container {
    display: flex;
  }
  
  .specialties-section {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid lightgray;
  }
  
  .specialties-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .specialty-category {
    display: flex;
    flex-direction: column;
  }
  
  .specialty-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  @media (min-width: 1200px) {
    .specialties-container {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem;
    }
    
    .specialty-category {
      flex: 1;
      min-width: 45%;
    }
  }
</style>

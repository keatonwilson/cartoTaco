<script>
  import RadarChart from "./RadarChart.svelte";
  import { getTopFive, percentageOfMaxArray } from "$lib/dataWrangling.js";
  import HoursOpen from "./HoursOpen.svelte";
  import SpiceGauge from "./SpiceGauge.svelte";
  import IconHighlight from "./IconHighlight.svelte";
  import SalsaCount from "./SalsaCount.svelte";
  import SpecCarousel from "./SpecCarousel.svelte";
  import SpecCard from "./SpecCard.svelte";

  export let data;
  
  let errorState = false;
  let errorMessage = "Unable to display data";
  
  // Default variables
  let menuArray = [];
  let topFiveItems = [];
  let topFiveValues = [];
  let proteinArray = [];
  let topFivePItems = [];
  let topFivePValues = [];
  let showLongDescription = false;

  // Validate required data
  try {
    if (!data || !data.name || !data.menuItems || !data.menuProtein) {
      errorState = true;
      errorMessage = "Missing required data";
    } else {
      // Process data only if validation passes
      // radar chart menu data
      menuArray = getTopFive(data.menuItems || {});
      topFiveItems = menuArray.map((subArray) => subArray[0]);
      topFiveValues = menuArray.map((subArray) => subArray[1]);

      // radar chart protein data
      proteinArray = getTopFive(data.menuProtein || {});
      topFivePItems = proteinArray.map((subArray) => subArray[0]);
      topFivePValues = proteinArray.map((subArray) => subArray[1]);
    }
  } catch (error) {
    console.error("Error processing card data:", error);
    errorState = true;
    errorMessage = "Error displaying data";
  }

  function toggleLongDescription() {
    showLongDescription = !showLongDescription;
  }
</script>

{#if errorState}
  <div id="error-content">
    <p>{errorMessage}</p>
  </div>
{:else}
  <div id="popup-content">
    <div class="left-panel">
      <h2 class="text-2xl font-semibold text-gray-800 mb-4">
        {data.name || 'Unknown Location'}
      </h2>
      <HoursOpen startHours={data.startHours || {}} endHours={data.endHours || {}} />
      <h2 class="text-m font-semibold text-gray-800 my-2">Type</h2>
      <IconHighlight type="siteType" data={data.type || 'unknown'} />
      <div class="description">
        <h2 class="text-m font-semibold text-gray-800 my-2">Description</h2>
        <p>{data.shortDescription || 'No description available'}</p>
        <div class="long-description" class:visible={showLongDescription}>
          <p>{data.longDescription || 'No detailed description available'}</p>
        </div>
        <span class="expand-button" on:click={toggleLongDescription}>
          {showLongDescription ? "Show less" : "Read more"}
        </span>
      </div>
      <h2 class="text-m font-semibold text-gray-800 my-2">Menu Summary</h2>
      <div class="radar-chart-container">
        <RadarChart labels={topFiveItems} data={topFiveValues} />
      </div>
    </div>
    <div class="right-panel" id="chart">
      <div class="top-row">
        <div class="protein-chart-container">
          <h2 class="text-m font-semibold text-gray-800 my-2">Protein</h2>
          <RadarChart labels={topFivePItems} data={topFivePValues} />
        </div>
        <div class="right-box">
          <h2 class="text-m font-semibold text-gray-800" id="spicy-label">Spiciness</h2>
          <SpiceGauge spiceValue={data.heatOverall || 0} />
          <h2 class="text-m font-semibold text-gray-800 my-2">Tortilla Type</h2>
          <IconHighlight type="tortilla" data={data.tortillaType || 'unknown'} />
        </div>
      </div>
      <div class='salsa-container'>
        <SalsaCount 
          value={data.salsaCount || 0} 
          meanValue={data.avgSalsaNum || 0} 
          maxValue={data.maxSalsaNum || 0} 
        />
      </div>
      
      <!-- Replace hardcoded data with dynamic specialty data when available -->
      {#if data.specialtyData && data.specialtyData.length > 0}
        <!-- Will implement specialty cards from data in next iteration -->
        <SpecCarousel specData={data.specialtyData} />
      {:else}
        <!-- Fallback to hardcoded examples -->
        <SpecCard itemDescrip='Pueblan super-torta with chipotle, queso oaxaca, avocado & a variety of proteins.' itemName='Cemita' cardType='Item'/>
        <SpecCard itemDescrip='Pueblan super-torta with chipotle, queso oaxaca, avocado & a variety of proteins.' itemName='Cemita' cardType='Protein'/>
        <SpecCard itemDescrip='Pueblan super-torta with chipotle, queso oaxaca, avocado & a variety of proteins.' itemName='Cemita' cardType='Salsa'/>
      {/if}
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
</style>

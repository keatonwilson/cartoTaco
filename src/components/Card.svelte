<script>
  import RadarChart from "./RadarChart.svelte";
  import { getTopFive, percentageOfMaxArray } from "$lib/dataWrangling.js";
  import HoursOpen from "./HoursOpen.svelte";
  import SpiceGauge from "./SpiceGauge.svelte";
  import IconHighlight from "./IconHighlight.svelte";
  import SalsaCount from "./SalsaCount.svelte";

  export let data;

  // radar chart menu data
  const menuArray = getTopFive(data.menuItems);
  const topFiveItems = menuArray.map((subArray) => subArray[0]);
  const topFiveValues = menuArray.map((subArray) => subArray[1]);

  // radar chart protein data
  const proteinArray = getTopFive(data.menuProtein);
  const topFivePItems = proteinArray.map((subArray) => subArray[0]);
  const topFivePValues = proteinArray.map((subArray) => subArray[1]);

  // hours
  const startHours = data.startHours;
  const endHours = data.endHours;

  // spice level
  const spiceValue = data.heatOverall;

  // defauly show long description
  let showLongDescription = false;


  function toggleLongDescription() {
    showLongDescription = !showLongDescription;
  }
</script>

<div id="popup-content">
  <div class="left-panel">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">
      {data.name}
    </h2>
    <HoursOpen {startHours} {endHours} />
    <h2 class="text-m font-semibold text-gray-800 my-2">Type</h2>
    <IconHighlight type="siteType" data={data.type}/>
    <div class="description">
      <h2 class="text-m font-semibold text-gray-800 my-2">Description</h2>
      <p>{data.shortDescription}</p>
      <div class="long-description" class:visible={showLongDescription}>
        <p>{data.longDescription}</p>
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
        <SpiceGauge {spiceValue} />
        <h2 class="text-m font-semibold text-gray-800 my-2">Tortilla Type</h2>
        <IconHighlight type="tortilla" data={data.tortillaType}/>
      </div>
    </div>
    <div class='salsa-container'>
      <SalsaCount value={data.salsaCount} meanValue={data.avgSalsaNum} maxValue={data.maxSalsaNum}/>
    </div>
  </div>
</div>

<style>

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

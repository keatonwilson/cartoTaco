<script>
  import RadarChart from './RadarChart.svelte';
  import { getTopFive, percentageOfMaxArray } from '$lib/dataWrangling.js';
  import HoursOpen from './HoursOpen.svelte';
  import SpiceGauge from './SpiceGauge.svelte';
  
  export let data;

  const menuArray = getTopFive(data.menuItems);
  const topFiveItems = menuArray.map(subArray => subArray[0]);
  const topFiveValues = menuArray.map(subArray => subArray[1]);

  const startHours = data.startHours;
  const endHours = data.endHours;

  const spiceValue = data.heatOverall;

  let showLongDescription = false;

  function toggleLongDescription() {
    showLongDescription = !showLongDescription;
  }
</script>

<style>
  #popup-content {
    display: flex;
    width: 100%;
    gap: 10px;
  }

  .left-panel, .right-panel {
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
  }

  .protein-chart-container {
    width: 65%;
  }

  .right-box {
    width: 35%;
    display: flex;
    flex-direction: column;
  }

  .right-box > * {
    flex: 1;
  }

  .icons {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }

  .icon {
    width: 50px;
    height: 50px;
    opacity: 0.3; /* Default faded */
  }

  .icon.highlight {
    opacity: 1; /* Highlighted icon */
  }
</style>

<div id="popup-content">
  <div class="left-panel">
    <h2>{data.name}</h2>
    <HoursOpen {startHours} {endHours}/>
    
    <!-- Three icons with dynamic gray go here -->
    <div class="icons">
      <img src="/shop_icon.svg" alt="Taco Shop" class:highlight={data.type === 'Brick and Mortar'} class="icon" />
      <img src="/stand_icon.svg" alt="Taco Stand" class:highlight={data.type === 'Stand'} class="icon" />
      <img src="/truck_icon.svg" alt="Taco Truck" class:highlight={data.type === 'Truck'} class="icon" />
    </div>

    <div class="description">
      <p>{data.shortDescription}</p>
      <div class="long-description" class:visible={showLongDescription}>
        <p>{data.longDescription}</p>
      </div>
      <span class="expand-button" on:click={toggleLongDescription}>
        {showLongDescription ? 'Show less' : 'Read more'}
      </span>
    </div>
    <RadarChart labels={topFiveItems} data={topFiveValues}/>
  </div>
  <div class="right-panel" id="chart">
    <div class="top-row">
      <div class='protein-chart-container'>
        <!-- <RadarChart labels={} data={}/> -->
      </div>
      <div class="right-box">
        <SpiceGauge {spiceValue} />
      </div>
    </div>
  </div>
</div>

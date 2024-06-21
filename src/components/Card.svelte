<script>
  import RadarChart from './RadarChart.svelte';
  import { getTopFive, percentageOfMaxArray } from '$lib/dataWrangling.js';
  import HoursOpen from './HoursOpen.svelte';
  // setup
  export let data;

  // smaller pieces of data
  const menuArray = getTopFive(data.menuItems);
  const topFiveItems = menuArray.map(subArray => subArray[0]);
  const topFiveValues = menuArray.map(subArray => subArray[1]);
  // const topFiveValuesNorm = percentageOfMaxArray(topFiveValues);
  
  const startHours = data.startHours;
  const endHours = data.endHours;

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
</style>

<div id="popup-content">
  <div class="left-panel">
    <h2>{data.name}</h2>
    <HoursOpen {startHours} {endHours}/>
    <p>{data.type}</p>
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
  <div class="right-panel" id="chart"></div>
</div>

<script>
  import RadarChart from './RadarChart.svelte';

  export let data;
  let radarChartRef;
  let showChart = false;

  let showLongDescription = false;

  function toggleLongDescription() {
    showLongDescription = !showLongDescription;
  }

  $: if (showChart) {
    radarChartRef.renderChart();
  }

  console.log('Rendering PopupContent with data:', data);
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
  }

  .left-panel {
    width: 30%;
  }

  .right-panel {
    width: 70%;
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
    <RadarChart />
  </div>
  <div class="right-panel" id="chart"></div>
</div>

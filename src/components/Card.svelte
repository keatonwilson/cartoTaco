<script>
  /**
   * @typedef {Object} Data
   * @property {string} name - The name of the popup.
   * @property {string} type - The type/description of the popup.
   * @property {string} shortDescription - A short description for the popup.
   * @property {string} longDescription - A long description for the popup.
   */

  /** @type {Data} */
  export let data;

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
  <h3>{data.name}</h3>
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
</div>
<div class="right-panel" id="chart"></div>
</div>

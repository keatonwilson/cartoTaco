<script>
    /**
   * @typedef {Object} Data
   * @property {string} name - The name of the popup.
   * @property {string} type - The type/description of the popup.
   */

  /** @type {Data} */
  export let data;
</script>

<div id="popup-content">
  <h3>{data.name}</h3>
  <p>{data.type}</p>
  <div id="chart"></div>
</div>
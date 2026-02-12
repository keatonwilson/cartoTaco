<script>
  import { filterConfig, filteredTacoData, processedTacoData } from '../lib/stores';
  import { SearchOutline, ChevronDownOutline, ChevronUpOutline } from 'flowbite-svelte-icons';

  let expanded = false;

  // Count of filtered results
  $: resultCount = $filteredTacoData.length;
  $: totalCount = $processedTacoData.length;

  function toggleExpanded() {
    expanded = !expanded;
  }

  function clearFilters() {
    filterConfig.set({
      searchText: '',
      proteins: {
        chicken: false,
        beef: false,
        pork: false,
        fish: false,
        veg: false
      },
      types: {
        'Brick and Mortar': false,
        'Stand': false,
        'Truck': false
      },
      spiceLevel: { min: 0, max: 10 },
      openNow: false
    });
  }

  // Check if any filters are active
  $: hasActiveFilters =
    $filterConfig.searchText !== '' ||
    Object.values($filterConfig.proteins).some(v => v) ||
    Object.values($filterConfig.types).some(v => v) ||
    $filterConfig.spiceLevel.min > 0 ||
    $filterConfig.spiceLevel.max < 10 ||
    $filterConfig.openNow;
</script>

<div class="filter-container">
  <!-- Compact Search Bar (Always Visible) -->
  <div class="filter-header">
    <div class="search-input-wrapper">
      <SearchOutline class="search-icon" size="sm" />
      <input
        type="text"
        placeholder="Search taco spots..."
        bind:value={$filterConfig.searchText}
        class="search-input"
      />
    </div>

    <button
      class="expand-button"
      on:click={toggleExpanded}
      aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
    >
      {#if expanded}
        <ChevronUpOutline size="sm" />
      {:else}
        <ChevronDownOutline size="sm" />
      {/if}
      <span class="filter-text">Filters</span>
      {#if hasActiveFilters && !expanded}
        <span class="active-indicator"></span>
      {/if}
    </button>
  </div>

  <!-- Expanded Filter Panel -->
  {#if expanded}
    <div class="filter-panel">
      <!-- Protein Filters -->
      <div class="filter-section">
        <h3 class="filter-title">Proteins</h3>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.proteins.chicken} />
            <span>Chicken</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.proteins.beef} />
            <span>Beef</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.proteins.pork} />
            <span>Pork</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.proteins.fish} />
            <span>Fish</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.proteins.veg} />
            <span>Vegetarian</span>
          </label>
        </div>
      </div>

      <!-- Type Filters -->
      <div class="filter-section">
        <h3 class="filter-title">Type</h3>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.types['Brick and Mortar']} />
            <span>Restaurant</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.types.Stand} />
            <span>Stand</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={$filterConfig.types.Truck} />
            <span>Truck</span>
          </label>
        </div>
      </div>

      <!-- Spice Level Filter -->
      <div class="filter-section">
        <h3 class="filter-title">
          Spice Level: {$filterConfig.spiceLevel.min} - {$filterConfig.spiceLevel.max}
        </h3>
        <div class="range-inputs">
          <div class="range-input-group">
            <label for="spice-min">Min</label>
            <input
              id="spice-min"
              type="range"
              min="0"
              max="10"
              bind:value={$filterConfig.spiceLevel.min}
              class="range-slider"
            />
          </div>
          <div class="range-input-group">
            <label for="spice-max">Max</label>
            <input
              id="spice-max"
              type="range"
              min="0"
              max="10"
              bind:value={$filterConfig.spiceLevel.max}
              class="range-slider"
            />
          </div>
        </div>
      </div>

      <!-- Open Now Filter -->
      <div class="filter-section">
        <label class="checkbox-label open-now-label">
          <input type="checkbox" bind:checked={$filterConfig.openNow} />
          <span class="open-now-text">Open Now</span>
        </label>
      </div>

      <!-- Results Counter -->
      <div class="results-counter">
        Showing <strong>{resultCount}</strong> of <strong>{totalCount}</strong> locations
      </div>

      <!-- Clear Filters Button -->
      {#if hasActiveFilters}
        <button class="clear-button" on:click={clearFilters}>
          Clear All Filters
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-container {
    position: absolute;
    top: 20px;
    right: 60px;
    z-index: 10;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    max-width: 400px;
  }

  .filter-header {
    display: flex;
    gap: 8px;
    padding: 12px;
  }

  .search-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: #666;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #FE795D;
  }

  .expand-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #f5f5f5;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #333;
    transition: background-color 0.2s;
    position: relative;
  }

  .expand-button:hover {
    background: #e8e8e8;
  }

  .filter-text {
    white-space: nowrap;
  }

  .active-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: #FE795D;
    border-radius: 50%;
  }

  .filter-panel {
    padding: 0 12px 12px 12px;
    border-top: 1px solid #eee;
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .filter-section {
    margin-top: 16px;
  }

  .filter-title {
    font-size: 13px;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
    user-select: none;
  }

  .checkbox-label:hover {
    background: #f0f0f0;
    border-color: #FE795D;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
    accent-color: #FE795D;
  }

  .checkbox-label input[type="checkbox"]:checked + span {
    font-weight: 600;
    color: #FE795D;
  }

  .range-inputs {
    display: flex;
    gap: 16px;
  }

  .range-input-group {
    flex: 1;
  }

  .range-input-group label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }

  .range-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #e0e0e0;
    outline: none;
    cursor: pointer;
  }

  .range-slider::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #FE795D;
    cursor: pointer;
  }

  .range-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #FE795D;
    cursor: pointer;
    border: none;
  }

  .open-now-label {
    background: #fff;
    border: 2px solid #e0e0e0;
    padding: 10px 14px;
    justify-content: center;
  }

  .open-now-label:hover {
    border-color: #FE795D;
  }

  .open-now-text {
    font-weight: 600;
    font-size: 14px;
  }

  .results-counter {
    margin-top: 16px;
    padding: 10px;
    background: #f9f9f9;
    border-radius: 6px;
    text-align: center;
    font-size: 13px;
    color: #666;
  }

  .results-counter strong {
    color: #FE795D;
    font-weight: 700;
  }

  .clear-button {
    width: 100%;
    margin-top: 12px;
    padding: 10px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .clear-button:hover {
    background: #d32f2f;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .filter-container {
      top: 10px;
      left: 10px;
      right: 60px; /* Leave space for map controls */
      max-width: none;
    }

    .filter-text {
      display: none;
    }
  }
</style>

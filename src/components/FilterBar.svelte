<script>
  import { filterConfig, filteredTacoData, processedTacoData } from '../lib/stores';
  import { isAuthenticated } from '$lib/authStore';
  import { SearchOutline, ChevronDownOutline, ChevronUpOutline, HeartSolid } from 'flowbite-svelte-icons';
  import { browser } from '$app/environment';
  import { trailModeActive, enterTrailMode, exitTrailMode } from '../lib/trailStore.js';
  import { tourExpandFilters } from '$lib/tourStore.js';

  let expanded = false;

  // Allow the tour to expand filters
  $: if ($tourExpandFilters) expanded = true;
  let containerEl;

  // Count of filtered results
  $: resultCount = $filteredTacoData.length;
  $: totalCount = $processedTacoData.length;

  // Aggregate unique styles per protein across all sites
  $: availableStyles = (() => {
    const result = {};
    for (const site of $processedTacoData) {
      if (!site.proteinStyles) continue;
      for (const [protein, styles] of Object.entries(site.proteinStyles)) {
        if (!result[protein]) result[protein] = new Set();
        for (const style of styles) result[protein].add(style);
      }
    }
    // Convert Sets to sorted arrays
    return Object.fromEntries(
      Object.entries(result).map(([p, set]) => [p, [...set].sort()])
    );
  })();

  function toggleStyleFilter(protein, style) {
    filterConfig.update(cfg => {
      const current = cfg.styleFilters[protein] || [];
      const idx = current.indexOf(style);
      const updated = idx === -1 ? [...current, style] : current.filter((_, i) => i !== idx);
      return { ...cfg, styleFilters: { ...cfg.styleFilters, [protein]: updated } };
    });
  }

  function toggleExpanded() {
    expanded = !expanded;
  }

  function handleWindowClick(event) {
    if (expanded && containerEl && !containerEl.contains(event.target)) {
      expanded = false;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && expanded) {
      expanded = false;
    }
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
      openNow: false,
      showFavoritesOnly: false,
      styleFilters: { chicken: [], beef: [], pork: [], fish: [], veg: [] }
    });
  }

  // Check if any filters are active
  $: hasActiveFilters =
    $filterConfig.searchText !== '' ||
    Object.values($filterConfig.proteins).some(v => v) ||
    Object.values($filterConfig.types).some(v => v) ||
    $filterConfig.spiceLevel.min > 0 ||
    $filterConfig.spiceLevel.max < 10 ||
    $filterConfig.openNow ||
    $filterConfig.showFavoritesOnly ||
    Object.values($filterConfig.styleFilters).some(arr => arr.length > 0);
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

<div class="filter-container" bind:this={containerEl}>
  <!-- Compact Search Bar (Always Visible) -->
  <div class="filter-header">
    <div class="search-input-wrapper" data-tour="search">
      <SearchOutline class="search-icon" size="sm" />
      <input
        type="text"
        placeholder="Search by name, menu item, type..."
        bind:value={$filterConfig.searchText}
        class="search-input"
      />
    </div>

    <button
      data-tour="trail"
      class="trail-button"
      class:active={$trailModeActive}
      on:click={$trailModeActive ? exitTrailMode : enterTrailMode}
      title={$trailModeActive ? 'Exit Trail Mode' : 'Build a Trail'}
      aria-label={$trailModeActive ? 'Exit Trail Mode' : 'Build a Trail'}
    >
      <!-- Route path icon -->
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="6" cy="19" r="3"/>
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
        <circle cx="18" cy="5" r="3"/>
      </svg>
      <span class="trail-text">Trail</span>
    </button>

    <button
      data-tour="filters"
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
      <!-- Favorites Filter (only show if authenticated) -->
      {#if $isAuthenticated}
        <div class="filter-section favorites-section">
          <label class="favorites-toggle">
            <input type="checkbox" bind:checked={$filterConfig.showFavoritesOnly} />
            <span class="favorites-label">
              {#if browser}
                <HeartSolid size="sm" class="heart-icon" />
              {/if}
              Show Favorites Only
            </span>
          </label>
        </div>
      {/if}

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
        <!-- Style sub-filters: appear below when a protein is checked and styles exist -->
        {#each ['chicken', 'beef', 'pork', 'fish', 'veg'] as protein}
          {#if $filterConfig.proteins[protein] && availableStyles[protein]?.length > 0}
            <div class="style-sub-row">
              <span class="style-sub-label">{protein}:</span>
              {#each availableStyles[protein] as style}
                <button
                  class="style-filter-chip"
                  class:active={$filterConfig.styleFilters[protein]?.includes(style)}
                  on:click={() => toggleStyleFilter(protein, style)}
                >
                  {style}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
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
    top: 86px; /* 66px header + 20px margin */
    right: 60px;
    z-index: 10;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    max-width: 400px;
  }

  :global(.dark) .filter-container {
    background: #1f2937;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
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

  :global(.dark) :global(.search-icon) {
    color: #9ca3af;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    background: white;
    color: #111827;
  }

  :global(.dark) .search-input {
    background: #111827;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .search-input:focus {
    border-color: #FE795D;
  }

  /* Trail mode button */
  .trail-button {
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
    transition: all 0.2s;
    flex-shrink: 0;
  }

  :global(.dark) .trail-button {
    background: #374151;
    color: #f9fafb;
  }

  .trail-button:hover {
    background: #e8e8e8;
  }

  :global(.dark) .trail-button:hover {
    background: #4b5563;
  }

  .trail-button.active {
    background: #FE795D;
    color: white;
  }

  .trail-button.active:hover {
    background: #e55a3c;
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

  :global(.dark) .expand-button {
    background: #374151;
    color: #f9fafb;
  }

  .expand-button:hover {
    background: #e8e8e8;
  }

  :global(.dark) .expand-button:hover {
    background: #4b5563;
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

  /* Favorites section styling */
  .favorites-section {
    margin-top: 0;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid #fe795d;
  }

  :global(.dark) .favorites-section {
    border-bottom-color: #fe795d;
  }

  .favorites-toggle {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #fff5f2 0%, #ffe4de 100%);
    border: 2px solid #fe795d;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  :global(.dark) .favorites-toggle {
    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
    border-color: #fe795d;
  }

  .favorites-toggle:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(254, 121, 93, 0.2);
  }

  .favorites-toggle input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #fe795d;
  }

  .favorites-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #374151;
    font-size: 0.95rem;
  }

  :global(.dark) .favorites-label {
    color: #f9fafb;
  }

  .favorites-toggle :global(.heart-icon) {
    color: #fe795d;
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

  .style-sub-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    padding-left: 4px;
  }

  .style-sub-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: capitalize;
    color: #FF9800;
    flex-shrink: 0;
  }

  :global(.dark) .style-sub-label {
    color: #FFB74D;
  }

  .style-filter-chip {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 10px;
    border: 1px solid #e0e0e0;
    background: #f9f9f9;
    color: #555;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  :global(.dark) .style-filter-chip {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .style-filter-chip:hover {
    border-color: #FF9800;
    color: #FF9800;
  }

  .style-filter-chip.active {
    background: rgba(255, 152, 0, 0.12);
    border-color: #FF9800;
    color: #FF9800;
    font-weight: 600;
  }

  :global(.dark) .style-filter-chip.active {
    background: rgba(255, 152, 0, 0.2);
    border-color: #FFB74D;
    color: #FFB74D;
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
      top: 76px; /* 66px header + 10px margin */
      left: 10px;
      right: 60px; /* Leave space for map controls */
      max-width: none;
    }

    .filter-text {
      display: none;
    }

    .trail-text {
      display: none;
    }

    .trail-button {
      padding: 8px 10px;
    }
  }
</style>

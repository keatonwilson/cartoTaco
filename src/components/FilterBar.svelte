<script>
  import { filterConfig, filteredTacoData, processedTacoData, flyToTarget, isOpenNow } from '../lib/stores';
  import { isAuthenticated } from '$lib/authStore';
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import CaretUp from 'phosphor-svelte/lib/CaretUp';
  import Heart from 'phosphor-svelte/lib/Heart';
  import Clock from 'phosphor-svelte/lib/Clock';
  import X from 'phosphor-svelte/lib/X';
  import MagicWand from 'phosphor-svelte/lib/MagicWand';
  import { browser } from '$app/environment';
  import { trailModeActive, enterTrailMode, exitTrailMode } from '../lib/trailStore.js';
  import { tourExpandFilters } from '$lib/tourStore.js';
  import { filterPanelOpen } from '$lib/uiStore.js';
  import { get } from 'svelte/store';

  const PROTEINS = [
    { key: 'chicken', label: 'Chicken' },
    { key: 'beef', label: 'Beef' },
    { key: 'pork', label: 'Pork' },
    { key: 'fish', label: 'Fish' },
    { key: 'veg', label: 'Vegetarian' }
  ];

  const TYPES = [
    { key: 'Brick and Mortar', label: 'Restaurant' },
    { key: 'Stand', label: 'Stand' },
    { key: 'Truck', label: 'Truck' }
  ];

  // Allow the tour to expand filters
  $: if ($tourExpandFilters) filterPanelOpen.set(true);
  let containerEl;

  // Count of filtered results
  $: resultCount = $filteredTacoData.length;
  $: totalCount = $processedTacoData.length;

  // Live city-composition counts shown on the filter chips.
  // Counts come from the full dataset (not the filtered one) so they read as
  // "how many spots serve this" rather than shifting under the user.
  $: proteinCounts = Object.fromEntries(
    PROTEINS.map(p => [
      p.key,
      $processedTacoData.filter(s => s.rawData?.protein?.[`${p.key}_yes`] === true).length
    ])
  );

  $: typeCounts = Object.fromEntries(
    TYPES.map(t => [t.key, $processedTacoData.filter(s => s.type === t.key).length])
  );

  $: openNowCount = $processedTacoData.filter(s => isOpenNow(s.rawData?.hours)).length;

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

  function toggleProtein(key) {
    filterConfig.update(cfg => ({
      ...cfg,
      proteins: { ...cfg.proteins, [key]: !cfg.proteins[key] },
      // Deactivating a protein clears its style sub-filters
      styleFilters: cfg.proteins[key]
        ? { ...cfg.styleFilters, [key]: [] }
        : cfg.styleFilters
    }));
  }

  function toggleType(key) {
    filterConfig.update(cfg => ({
      ...cfg,
      types: { ...cfg.types, [key]: !cfg.types[key] }
    }));
  }

  function toggleStyleFilter(protein, style) {
    filterConfig.update(cfg => {
      const current = cfg.styleFilters[protein] || [];
      const idx = current.indexOf(style);
      const updated = idx === -1 ? [...current, style] : current.filter((_, i) => i !== idx);
      return { ...cfg, styleFilters: { ...cfg.styleFilters, [protein]: updated } };
    });
  }

  function toggleOpenNow() {
    filterConfig.update(cfg => ({ ...cfg, openNow: !cfg.openNow }));
  }

  function toggleFavoritesOnly() {
    filterConfig.update(cfg => ({ ...cfg, showFavoritesOnly: !cfg.showFavoritesOnly }));
  }

  // Dual-thumb spice slider: clamp so the thumbs can't cross
  function onSpiceMinInput(e) {
    const v = Number(e.target.value);
    filterConfig.update(cfg => ({
      ...cfg,
      spiceLevel: { ...cfg.spiceLevel, min: Math.min(v, cfg.spiceLevel.max) }
    }));
  }

  function onSpiceMaxInput(e) {
    const v = Number(e.target.value);
    filterConfig.update(cfg => ({
      ...cfg,
      spiceLevel: { ...cfg.spiceLevel, max: Math.max(v, cfg.spiceLevel.min) }
    }));
  }

  function resetSpice() {
    filterConfig.update(cfg => ({ ...cfg, spiceLevel: { min: 0, max: 10 } }));
  }

  function clearSearch() {
    filterConfig.update(cfg => ({ ...cfg, searchText: '' }));
  }

  function toggleExpanded() {
    filterPanelOpen.update(v => !v);
  }

  function handleWindowClick(event) {
    if ($filterPanelOpen && containerEl && !containerEl.contains(event.target)) {
      filterPanelOpen.set(false);
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && $filterPanelOpen) {
      filterPanelOpen.set(false);
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

  function surpriseMe() {
    const sites = get(filteredTacoData);
    if (!sites.length) return;
    const site = sites[Math.floor(Math.random() * sites.length)];
    flyToTarget.set(site);
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

  // Flat list of active filters for the removable-chip row
  $: activeChips = (() => {
    const chips = [];
    const cfg = $filterConfig;
    if (cfg.searchText) {
      chips.push({ id: 'search', label: `“${cfg.searchText}”`, remove: clearSearch });
    }
    for (const p of PROTEINS) {
      if (cfg.proteins[p.key]) {
        chips.push({ id: `protein-${p.key}`, label: p.label, remove: () => toggleProtein(p.key) });
      }
      for (const style of cfg.styleFilters[p.key] || []) {
        chips.push({
          id: `style-${p.key}-${style}`,
          label: `${p.label} · ${style}`,
          remove: () => toggleStyleFilter(p.key, style)
        });
      }
    }
    for (const t of TYPES) {
      if (cfg.types[t.key]) {
        chips.push({ id: `type-${t.key}`, label: t.label, remove: () => toggleType(t.key) });
      }
    }
    if (cfg.spiceLevel.min > 0 || cfg.spiceLevel.max < 10) {
      chips.push({
        id: 'spice',
        label: `Spice ${cfg.spiceLevel.min}–${cfg.spiceLevel.max}`,
        remove: resetSpice
      });
    }
    if (cfg.openNow) chips.push({ id: 'open', label: 'Open Now', remove: toggleOpenNow });
    if (cfg.showFavoritesOnly) {
      chips.push({ id: 'favs', label: 'Favorites', remove: toggleFavoritesOnly });
    }
    return chips;
  })();
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleKeydown} />

<div class="filter-container" bind:this={containerEl}>
  <!-- Compact Search Bar (Always Visible) -->
  <div class="filter-header">
    <div class="search-input-wrapper" data-tour="search">
      <MagnifyingGlass class="search-icon" size={16} />
      <input
        type="text"
        placeholder="Search by name, menu item, type..."
        bind:value={$filterConfig.searchText}
        class="search-input"
      />
    </div>

    <button
      data-tour="surprise"
      class="surprise-button"
      on:click={surpriseMe}
      title="Surprise Me"
      aria-label="Surprise Me — pick a random spot"
      disabled={$filteredTacoData.length === 0}
    >
      <MagicWand size={16} weight="duotone" />
      <span class="surprise-text">Surprise Me</span>
    </button>

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
      aria-label={$filterPanelOpen ? 'Collapse filters' : 'Expand filters'}
    >
      {#if $filterPanelOpen}
        <CaretUp size={16} />
      {:else}
        <CaretDown size={16} />
      {/if}
      <span class="filter-text">Filters</span>
      {#if hasActiveFilters && !$filterPanelOpen}
        <span class="active-indicator"></span>
      {/if}
    </button>
  </div>

  <!-- Active filters: removable chips, visible even when the panel is closed -->
  {#if activeChips.length > 0}
    <div class="active-chips-row">
      {#each activeChips as chip (chip.id)}
        <button class="active-chip" on:click={chip.remove} title="Remove filter">
          {chip.label}
          <X size={11} weight="bold" />
        </button>
      {/each}
      <button class="clear-all-link" on:click={clearFilters}>Clear all</button>
    </div>
  {/if}

  <!-- Expanded Filter Panel -->
  {#if $filterPanelOpen}
    <div class="filter-panel">
      <!-- Quick toggles -->
      <div class="filter-section">
        <div class="chip-group">
          <button
            class="filter-chip"
            class:on={$filterConfig.openNow}
            on:click={toggleOpenNow}
            aria-pressed={$filterConfig.openNow}
          >
            {#if browser}<Clock size={13} />{/if}
            Open Now
            <span class="chip-count">{openNowCount}</span>
          </button>
          {#if $isAuthenticated}
            <button
              class="filter-chip"
              class:on={$filterConfig.showFavoritesOnly}
              on:click={toggleFavoritesOnly}
              aria-pressed={$filterConfig.showFavoritesOnly}
            >
              {#if browser}<Heart size={13} weight={$filterConfig.showFavoritesOnly ? 'fill' : 'regular'} />{/if}
              Favorites Only
            </button>
          {/if}
        </div>
      </div>

      <!-- Protein Filters -->
      <div class="filter-section">
        <h3 class="filter-title">Proteins</h3>
        <div class="chip-group">
          {#each PROTEINS as protein}
            <button
              class="filter-chip"
              class:on={$filterConfig.proteins[protein.key]}
              on:click={() => toggleProtein(protein.key)}
              aria-pressed={$filterConfig.proteins[protein.key]}
            >
              {protein.label}
              <span class="chip-count">{proteinCounts[protein.key] ?? 0}</span>
            </button>
          {/each}
        </div>
        <!-- Style sub-filters: appear below when a protein is selected and styles exist -->
        {#each PROTEINS as protein}
          {#if $filterConfig.proteins[protein.key] && availableStyles[protein.key]?.length > 0}
            <div class="style-sub-row">
              <span class="style-sub-label">{protein.label}:</span>
              {#each availableStyles[protein.key] as style}
                <button
                  class="style-filter-chip"
                  class:active={$filterConfig.styleFilters[protein.key]?.includes(style)}
                  on:click={() => toggleStyleFilter(protein.key, style)}
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
        <div class="chip-group">
          {#each TYPES as type}
            <button
              class="filter-chip"
              class:on={$filterConfig.types[type.key]}
              on:click={() => toggleType(type.key)}
              aria-pressed={$filterConfig.types[type.key]}
            >
              {type.label}
              <span class="chip-count">{typeCounts[type.key] ?? 0}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Spice Level Filter: one dual-thumb range -->
      <div class="filter-section">
        <h3 class="filter-title">
          Spice Level: {$filterConfig.spiceLevel.min} – {$filterConfig.spiceLevel.max}
        </h3>
        <div class="dual-range">
          <div class="dual-track"></div>
          <div
            class="dual-fill"
            style="left:{$filterConfig.spiceLevel.min * 10}%; width:{($filterConfig.spiceLevel.max - $filterConfig.spiceLevel.min) * 10}%"
          ></div>
          <input
            type="range"
            min="0"
            max="10"
            aria-label="Minimum spice level"
            value={$filterConfig.spiceLevel.min}
            on:input={onSpiceMinInput}
          />
          <input
            type="range"
            min="0"
            max="10"
            aria-label="Maximum spice level"
            value={$filterConfig.spiceLevel.max}
            on:input={onSpiceMaxInput}
          />
        </div>
        <div class="range-scale">
          <span>0 · none</span>
          <span>10 · scorching</span>
        </div>
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
    z-index: 200; /* above the bottom sheet (150) so the panel isn't hidden behind it */
    background: var(--surface-1);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    width: 560px;
    max-width: 560px;
  }

  :global(.dark) .filter-container {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .filter-header {
    display: flex;
    gap: 8px;
    padding: 12px;
  }

  .search-input-wrapper {
    position: relative;
    flex: 1 1 0;
    min-width: 150px;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 12px;
    color: var(--ink-3);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid var(--line-1);
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    background: var(--surface-1);
    color: var(--ink-1);
  }

  :global(.dark) .search-input {
    background: var(--surface-2);
  }

  .search-input:focus {
    border-color: var(--accent);
  }

  /* Surprise Me button */
  .surprise-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--accent-soft);
    border: 1.5px solid var(--accent);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--accent);
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .surprise-button:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .surprise-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Trail mode button */
  .trail-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--surface-3);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink-1);
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .trail-button:hover {
    background: var(--line-1);
  }

  .trail-button.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .trail-button.active:hover {
    background: var(--accent-hover);
  }

  .expand-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--surface-3);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink-1);
    transition: background-color 0.2s;
    position: relative;
  }

  .expand-button:hover {
    background: var(--line-1);
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
    background: var(--accent);
    border-radius: 50%;
  }

  /* Active-filters chip row (visible even when the panel is collapsed) */
  .active-chips-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 0 12px 10px;
  }

  .active-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--accent-hover);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.dark) .active-chip {
    color: var(--accent);
  }

  .active-chip:hover {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .clear-all-link {
    background: none;
    border: none;
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    text-decoration: underline;
    cursor: pointer;
    padding: 3px 4px;
  }

  .clear-all-link:hover {
    color: var(--error);
  }

  .filter-panel {
    padding: 0 12px 12px 12px;
    border-top: 1px solid var(--line-1);
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
    margin-top: 14px;
  }

  .filter-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-2);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-variant-numeric: tabular-nums;
  }

  /* Filter chips with counts */
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
    color: var(--ink-1);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .filter-chip:hover:not(.on) {
      border-color: var(--accent);
      color: var(--accent);
    }
  }

  .filter-chip.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-hover);
    font-weight: 600;
  }

  :global(.dark) .filter-chip.on {
    color: var(--accent);
  }

  .chip-count {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--ink-2);
  }

  .filter-chip.on .chip-count {
    background: var(--accent);
    color: var(--accent-contrast);
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
    color: var(--accent-hover);
    flex-shrink: 0;
  }

  :global(.dark) .style-sub-label {
    color: var(--accent);
  }

  .style-filter-chip {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 10px;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
    color: var(--ink-2);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .style-filter-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .style-filter-chip.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-hover);
    font-weight: 600;
  }

  :global(.dark) .style-filter-chip.active {
    color: var(--accent);
  }

  /* Dual-thumb spice range */
  .dual-range {
    position: relative;
    height: 24px;
    margin: 4px 2px 0;
  }

  .dual-track {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 0;
    right: 0;
    height: 6px;
    border-radius: 3px;
    background: var(--line-1);
  }

  .dual-fill {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 6px;
    border-radius: 3px;
    background: var(--accent);
  }

  .dual-range input[type='range'] {
    position: absolute;
    inset: 0;
    width: 100%;
    margin: 0;
    background: none;
    -webkit-appearance: none;
    appearance: none;
    /* Only the thumbs are interactive — the two inputs overlap fully */
    pointer-events: none;
  }

  .dual-range input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--surface-1);
    border: 2px solid var(--accent);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .dual-range input[type='range']::-moz-range-thumb {
    pointer-events: auto;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--surface-1);
    border: 2px solid var(--accent);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  .range-scale {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--ink-3);
    margin-top: 2px;
  }

  .results-counter {
    margin-top: 14px;
    padding: 8px;
    background: var(--surface-2);
    border-radius: 6px;
    text-align: center;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }

  .results-counter strong {
    color: var(--accent);
    font-weight: 700;
  }

  .clear-button {
    width: 100%;
    margin-top: 12px;
    padding: 9px;
    background: transparent;
    color: var(--error);
    border: 1px solid var(--error);
    border-radius: 6px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }

  .clear-button:hover {
    background: var(--error);
    color: #fff;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .filter-container {
      top: 76px; /* 66px header + 10px margin */
      left: 10px;
      right: 60px; /* Leave space for map controls */
      width: auto;
      max-width: none;
    }

    /* Cap the expanded panel height so it can't cover the entire map */
    .filter-panel {
      max-height: 55vh;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    .filter-text {
      display: none;
    }

    .trail-text {
      display: none;
    }

    .surprise-text {
      display: none;
    }

    .trail-button {
      padding: 8px 10px;
    }

    .surprise-button {
      padding: 8px 10px;
    }
  }
</style>

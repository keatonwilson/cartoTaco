<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { processedTacoData, isLoading, summaryStats } from '$lib/stores';
  import { isMobile } from '$lib/deviceDetection';
  import RadarChart from '../../components/RadarChart.svelte';
  import SpiceGauge from '../../components/SpiceGauge.svelte';
  import SalsaCount from '../../components/SalsaCount.svelte';
  import HoursOpen from '../../components/HoursOpen.svelte';
  import IconHighlight from '../../components/IconHighlight.svelte';
  import SpecCarousel from '../../components/SpecCarousel.svelte';

  // Parse IDs from URL
  $: ids = ($page.url.searchParams.get('ids') || '').split(',').map(Number).filter(Boolean);
  $: sites = ids.map(id => $processedTacoData.find(s => s.est_id === id)).filter(Boolean);

  // Winner computation — returns array of est_ids that share the max/min
  function getWinners(siteList, accessor) {
    if (siteList.length < 2) return [];
    const values = siteList.map(s => accessor(s) || 0);
    const max = Math.max(...values);
    if (max === 0) return [];
    return siteList.filter((s, i) => values[i] === max).map(s => s.est_id);
  }

  $: salsaWinners = getWinners(sites, s => s.salsaCount);
  $: spiceWinners = getWinners(sites, s => s.heatOverall);
  $: menuWinners = getWinners(sites, s => (s.topFiveMenuItems || []).length);
  $: proteinWinners = getWinners(sites, s => (s.topFiveProteinItems || []).length);

  // Mobile: active card index
  let activeCardIndex = 0;

  // Reactive current site for mobile view
  $: activeSite = sites[activeCardIndex] || null;

  // Share comparison
  let copied = false;
  async function shareComparison() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      // silent
    }
  }
</script>

<div class="comparison-page">
  <!-- Header -->
  <div class="page-header">
    <button class="back-btn" on:click={() => goto('/')}>
      &larr; Back to Map
    </button>
    <h1 class="page-title">Spot Comparison</h1>
    <button class="share-btn" on:click={shareComparison} disabled={sites.length < 2}>
      {copied ? 'Copied!' : 'Share'}
    </button>
  </div>

  {#if $isLoading}
    <div class="status-message">Loading data...</div>
  {:else if sites.length < 2}
    <div class="status-message">
      <p>Select 2-3 spots from the map to compare them.</p>
      <button class="back-link" on:click={() => goto('/')}>Go to Map</button>
    </div>
  {:else if $isMobile}
    <!-- MOBILE: Tab navigation + swipeable cards -->
    <div class="mobile-tabs">
      {#each sites as site, i}
        <button
          class="mobile-tab"
          class:active={activeCardIndex === i}
          on:click={() => { activeCardIndex = i; }}
        >
          {site.name}
        </button>
      {/each}
    </div>

    {#if activeSite}
      <div class="mobile-card">
        {#key activeCardIndex}
          <div class="card-section">
            <h2 class="site-name">{activeSite.name}</h2>
            <IconHighlight type="siteType" data={activeSite.type || 'unknown'} />
          </div>

          <div class="card-section">
            <h3 class="section-label">Menu</h3>
            <div class="chart-container">
              <RadarChart labels={activeSite.topFiveMenuItems || []} data={activeSite.topFiveMenuValues || []} />
            </div>
          </div>

          <div class="card-section">
            <h3 class="section-label">Protein</h3>
            <div class="chart-container">
              <RadarChart labels={activeSite.topFiveProteinItems || []} data={activeSite.topFiveProteinValues || []} />
            </div>
            {#if activeSite.proteinStyles && Object.keys(activeSite.proteinStyles).length > 0}
              <div class="protein-styles">
                {#each Object.entries(activeSite.proteinStyles) as [protein, styles]}
                  <div class="protein-style-row">
                    <span class="protein-label">{protein}</span>
                    <div class="style-chips">
                      {#each styles as style}
                        <span class="style-chip">{style}</span>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="card-section" class:winner={spiceWinners.includes(activeSite.est_id)}>
            <h3 class="section-label">Spiciness</h3>
            <SpiceGauge spiceValue={activeSite.heatOverall || 0} />
          </div>

          <div class="card-section" class:winner={salsaWinners.includes(activeSite.est_id)}>
            <h3 class="section-label">Salsas</h3>
            <SalsaCount
              value={activeSite.salsaCount || 0}
              meanValue={$summaryStats.avgSalsaNum || 0}
              maxValue={$summaryStats.maxSalsaNum || 0}
            />
          </div>

          <div class="card-section">
            <HoursOpen startHours={activeSite.startHours || {}} endHours={activeSite.endHours || {}} />
          </div>

          <div class="card-section">
            <h3 class="section-label">Specialties</h3>
            {#if activeSite.specialties && activeSite.specialties.length > 0}
              <SpecCarousel specialties={activeSite.specialties} />
            {:else}
              <p class="no-data">None listed</p>
            {/if}
          </div>
        {/key}
      </div>
    {/if}
  {:else}
    <!-- DESKTOP: Side-by-side grid -->
    <div class="comparison-grid" style="grid-template-columns: 140px repeat({sites.length}, 1fr);">
      <!-- Row: Name + Type -->
      <div class="row-label">Spot</div>
      {#each sites as site}
        <div class="col-header">
          <h2 class="site-name">{site.name}</h2>
          <IconHighlight type="siteType" data={site.type || 'unknown'} />
        </div>
      {/each}

      <!-- Row: Menu Radar -->
      <div class="row-label">Menu</div>
      {#each sites as site}
        <div class="chart-cell" class:winner={menuWinners.includes(site.est_id)}>
          <RadarChart labels={site.topFiveMenuItems || []} data={site.topFiveMenuValues || []} />
        </div>
      {/each}

      <!-- Row: Protein Radar + Styles -->
      <div class="row-label">Protein</div>
      {#each sites as site}
        <div class="chart-cell" class:winner={proteinWinners.includes(site.est_id)}>
          <RadarChart labels={site.topFiveProteinItems || []} data={site.topFiveProteinValues || []} />
          {#if site.proteinStyles && Object.keys(site.proteinStyles).length > 0}
            <div class="protein-styles">
              {#each Object.entries(site.proteinStyles) as [protein, styles]}
                <div class="protein-style-row">
                  <span class="protein-label">{protein}</span>
                  <div class="style-chips">
                    {#each styles as style}
                      <span class="style-chip">{style}</span>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      <!-- Row: Spice Gauge -->
      <div class="row-label">Spiciness</div>
      {#each sites as site}
        <div class="stat-cell" class:winner={spiceWinners.includes(site.est_id)}>
          <SpiceGauge spiceValue={site.heatOverall || 0} />
        </div>
      {/each}

      <!-- Row: Salsa Count -->
      <div class="row-label">Salsas</div>
      {#each sites as site}
        <div class="stat-cell" class:winner={salsaWinners.includes(site.est_id)}>
          <SalsaCount
            value={site.salsaCount || 0}
            meanValue={$summaryStats.avgSalsaNum || 0}
            maxValue={$summaryStats.maxSalsaNum || 0}
          />
        </div>
      {/each}

      <!-- Row: Hours -->
      <div class="row-label">Hours</div>
      {#each sites as site}
        <div class="hours-cell">
          <HoursOpen startHours={site.startHours || {}} endHours={site.endHours || {}} />
        </div>
      {/each}

      <!-- Row: Specialties -->
      <div class="row-label">Specialties</div>
      {#each sites as site}
        <div class="specialty-cell">
          {#if site.specialties && site.specialties.length > 0}
            <SpecCarousel specialties={site.specialties} />
          {:else}
            <p class="no-data">None listed</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .comparison-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    padding-top: 80px;
    min-height: 100vh;
  }

  /* Header */
  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .page-title {
    flex: 1;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  :global(.dark) .page-title {
    color: #f9fafb;
  }

  .back-btn {
    padding: 8px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    color: #374151;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  :global(.dark) .back-btn {
    background: #1f2937;
    border-color: #374151;
    color: #d1d5db;
  }

  .back-btn:hover {
    border-color: #FE795D;
    color: #FE795D;
  }

  .share-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: #FE795D;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .share-btn:hover:not(:disabled) {
    background: #e55a3c;
  }

  .share-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Status */
  .status-message {
    text-align: center;
    padding: 4rem 2rem;
    color: #6b7280;
    font-size: 1rem;
  }

  :global(.dark) .status-message {
    color: #9ca3af;
  }

  .back-link {
    margin-top: 1rem;
    padding: 10px 24px;
    border: none;
    border-radius: 8px;
    background: #FE795D;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .back-link:hover {
    background: #e55a3c;
  }

  /* ===== DESKTOP GRID ===== */
  .comparison-grid {
    display: grid;
    gap: 0;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }

  :global(.dark) .comparison-grid {
    border-color: #374151;
    background: #111827;
  }

  .row-label {
    padding: 12px 16px;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
  }

  :global(.dark) .row-label {
    background: #1f2937;
    color: #9ca3af;
    border-bottom-color: #374151;
    border-right-color: #374151;
  }

  .col-header {
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: #f9fafb;
  }

  :global(.dark) .col-header {
    background: #1f2937;
    border-bottom-color: #374151;
  }

  .site-name {
    font-size: 1rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
    text-align: center;
  }

  :global(.dark) .site-name {
    color: #f9fafb;
  }

  .chart-cell {
    padding: 12px;
    height: 240px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  :global(.dark) .chart-cell {
    border-bottom-color: #374151;
  }

  .stat-cell {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  :global(.dark) .stat-cell {
    border-bottom-color: #374151;
  }

  .hours-cell {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  :global(.dark) .hours-cell {
    border-bottom-color: #374151;
  }

  /* Scale down hours to fit columns */
  .hours-cell :global(.container) {
    font-size: 10px;
    padding: 4px 6px;
  }

  .hours-cell :global(.day) {
    width: 16px;
    margin: 0 2px;
  }

  .specialty-cell {
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Winner highlighting */
  .winner {
    background: rgba(254, 121, 93, 0.06);
    border-left: 3px solid #FE795D;
  }

  :global(.dark) .winner {
    background: rgba(254, 121, 93, 0.1);
  }

  .no-data {
    color: #9ca3af;
    font-size: 13px;
    font-style: italic;
    margin: 0;
  }

  /* Protein styles (shared mobile + desktop) */
  .protein-styles {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
    width: 100%;
  }

  .protein-style-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .protein-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: capitalize;
    color: #FF9800;
    min-width: 44px;
    flex-shrink: 0;
  }

  :global(.dark) .protein-label {
    color: #FFB74D;
  }

  .style-chip {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    border: 1px solid #FF9800;
    color: #FF9800;
    background: rgba(255, 152, 0, 0.08);
    white-space: nowrap;
  }

  :global(.dark) .style-chip {
    background: rgba(255, 152, 0, 0.15);
    color: #FFB74D;
    border-color: #FFB74D;
  }

  /* ===== MOBILE ===== */
  .mobile-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 1rem;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .mobile-tab {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    color: #374151;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.dark) .mobile-tab {
    background: #1f2937;
    border-color: #374151;
    color: #d1d5db;
  }

  .mobile-tab.active {
    background: #FE795D;
    color: white;
    border-color: #FE795D;
  }

  .mobile-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  :global(.dark) .mobile-card {
    background: #111827;
    border-color: #374151;
  }

  .card-section {
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  :global(.dark) .card-section {
    border-bottom-color: #374151;
  }

  .card-section:last-child {
    border-bottom: none;
  }

  .card-section.winner {
    background: rgba(254, 121, 93, 0.06);
    border-left: 3px solid #FE795D;
  }

  :global(.dark) .card-section.winner {
    background: rgba(254, 121, 93, 0.1);
  }

  .section-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    margin: 0 0 8px 0;
  }

  :global(.dark) .section-label {
    color: #9ca3af;
  }

  .chart-container {
    height: 200px;
  }
</style>

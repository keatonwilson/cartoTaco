<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { processedTacoData, isLoading, summaryStats } from '$lib/stores';
  import { radarMax } from '$lib/chartTheme';
  import { isMobile } from '$lib/deviceDetection';
  import RadarChart from '../../components/RadarChart.svelte';
  import SpiceGauge from '../../components/SpiceGauge.svelte';
  import SalsaCount from '../../components/SalsaCount.svelte';
  import HoursOpen from '../../components/HoursOpen.svelte';
  import IconHighlight from '../../components/IconHighlight.svelte';
  import SpecCarousel from '../../components/SpecCarousel.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import VibeFingerprint from '../../components/VibeFingerprint.svelte';

  // Parse IDs from URL. Pending (unvetted) spots have no comparable data —
  // drop them even if a shared URL includes their id.
  $: ids = ($page.url.searchParams.get('ids') || '').split(',').map(Number).filter(Boolean);
  $: sites = ids
    .map(id => $processedTacoData.find(s => s.est_id === id))
    .filter(Boolean)
    .filter(s => !s.isPending);

  // Winner computation — returns array of est_ids that share the max value
  function getWinners(siteList, accessor) {
    if (siteList.length < 2) return [];
    const values = siteList.map(s => accessor(s) || 0);
    const max = Math.max(...values);
    if (max === 0) return [];
    return siteList.filter((s, i) => values[i] === max).map(s => s.est_id);
  }

  $: salsaWinners = getWinners(sites, s => s.salsaCount);
  $: spiceWinners = getWinners(sites, s => s.heatOverall);

  // ── Overlay radar data: shared axes so shapes are directly comparable ──
  const PROTEIN_AXES = ['chicken', 'beef', 'pork', 'fish', 'veg'];

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Union of the compared sites' top menu items (capped so labels stay legible)
  $: menuAxes = (() => {
    const seen = [];
    for (const site of sites) {
      for (const item of site.topFiveMenuItems || []) {
        if (!seen.includes(item)) seen.push(item);
      }
    }
    return seen.slice(0, 8);
  })();

  function menuValueFor(site, item) {
    const entry = (site.menuItems || []).find(([k]) => k === `${item}_perc`);
    const v = entry ? parseFloat(entry[1]) : 0;
    return isNaN(v) ? 0 : Math.round(v * 100);
  }

  function proteinValueFor(site, p) {
    const v = parseFloat(site.rawData?.protein?.[`${p}_perc`]);
    return isNaN(v) ? 0 : Math.round(v * 100);
  }

  $: menuSeries = sites.map(site => ({
    name: site.name,
    values: menuAxes.map(a => menuValueFor(site, a))
  }));

  $: proteinSeries = sites.map(site => ({
    name: site.name,
    values: PROTEIN_AXES.map(p => proteinValueFor(site, p))
  }));

  // One scale across the spots being compared (not the whole city), shared by
  // the desktop overlays and the mobile per-spot radars alike
  $: comparedMenuMax = radarMax(
    ...menuSeries.map(s => s.values),
    ...sites.map(s => s.topFiveMenuValues || [])
  );
  $: comparedProteinMax = radarMax(
    ...proteinSeries.map(s => s.values),
    ...sites.map(s => s.topFiveProteinValues || [])
  );

  // Mobile: active card index
  let activeCardIndex = 0;
  $: activeSite = sites[activeCardIndex] || null;

  // "At a glance" verdicts: leader per metric with its margin over second place
  function menuBreadth(site) {
    return Object.entries(site.rawData?.menu || {}).filter(
      ([k, v]) => k.endsWith('_yes') && v === true
    ).length;
  }

  $: verdicts = sites.length >= 2
    ? [
        { label: 'Spiciest', accessor: (s) => s.heatOverall || 0, unit: '/10' },
        { label: 'Most salsas', accessor: (s) => s.salsaCount || 0, unit: ' salsas' },
        { label: 'Biggest menu', accessor: (s) => menuBreadth(s), unit: ' items' }
      ]
        .map(({ label, accessor, unit }) => {
          const ranked = [...sites].sort((a, b) => accessor(b) - accessor(a));
          const lead = accessor(ranked[0]);
          if (lead === 0) return null;
          const second = accessor(ranked[1]);
          const tie = lead === second;
          const margin = Math.round((lead - second) * 10) / 10;
          return {
            label,
            name: tie ? 'Tie' : ranked[0].name,
            value: `${lead}${unit}`,
            margin: tie ? null : `+${margin}`
          };
        })
        .filter(Boolean)
    : [];

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
  <!-- Sticky command bar: page actions (+ spot tabs on mobile) stay reachable
       at any scroll depth -->
  <div class="sticky-zone">
    <div class="page-header">
      <button class="back-btn" on:click={() => goto('/')}>
        &larr; Back to Map
      </button>
      <h1 class="page-title">Spot Comparison</h1>
      <button class="share-btn" on:click={shareComparison} disabled={sites.length < 2}>
        {copied ? 'Copied!' : 'Share'}
      </button>
    </div>
    {#if browser && !$isLoading && $isMobile && sites.length >= 2}
      <div class="mobile-tabs">
        {#each sites as site, i}
          <button
            class="mobile-tab"
            class:tab-active={activeCardIndex === i}
            on:click={() => { activeCardIndex = i; }}
          >
            {site.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if $isLoading || !browser}
    <LoadingState message="Lining up the contenders…" />
  {:else if sites.length < 2}
    <EmptyState
      emoji="⚖️"
      title="Nothing to compare yet"
      message="Pick 2–3 spots from the map with the + Compare button and they'll face off here."
      ctaLabel="Go to Map"
      onCta={() => goto('/')}
    />
  {:else}
    <!-- At a glance: the verdict before any scrolling -->
    {#if verdicts.length > 0}
      <div class="verdict-strip">
        {#each verdicts as v}
          <div class="verdict">
            <span class="verdict-label">{v.label}</span>
            <span class="verdict-name">{v.name}</span>
            <span class="verdict-value">
              {v.value}{#if v.margin}&nbsp;<em>({v.margin})</em>{/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}

    {#if $isMobile}
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
              <RadarChart
                labels={activeSite.topFiveMenuItems || []}
                data={activeSite.topFiveMenuValues || []}
                max={comparedMenuMax}
              />
            </div>
          </div>

          <div class="card-section">
            <h3 class="section-label">Protein</h3>
            <div class="chart-container">
              <RadarChart
                labels={activeSite.topFiveProteinItems || []}
                data={activeSite.topFiveProteinValues || []}
                max={comparedProteinMax}
              />
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
            <h3 class="section-label">Hours</h3>
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
    <!-- DESKTOP: sticky spot-name header row + side-by-side grid.
         The header lives in its own grid: sticky can't work on items inside
         .comparison-grid (its overflow:hidden makes a clipping box, and grid
         items can only stick within their own row track anyway). -->
    <div class="comparison-head" style="grid-template-columns: 130px repeat({sites.length}, 1fr);">
      <div class="row-label">Spot</div>
      {#each sites as site}
        <div class="col-header">
          <h2 class="site-name">{site.name}</h2>
          <IconHighlight type="siteType" data={site.type || 'unknown'} />
        </div>
      {/each}
    </div>
    <div class="comparison-grid" style="grid-template-columns: 130px repeat({sites.length}, 1fr);">
      <!-- Row: Menu radar — one overlay, shared axes, one series per spot -->
      <div class="row-label">Menu</div>
      <div class="chart-cell overlay-cell" style="grid-column: 2 / -1;">
        <RadarChart labels={menuAxes} seriesList={menuSeries} max={comparedMenuMax} />
      </div>

      <!-- Row: Protein radar — fixed 5 axes so shapes compare honestly -->
      <div class="row-label">Protein</div>
      <div class="chart-cell overlay-cell" style="grid-column: 2 / -1;">
        <RadarChart labels={PROTEIN_AXES.map(capitalize)} seriesList={proteinSeries} max={comparedProteinMax} />
        <div class="overlay-styles">
          {#each sites as site}
            {#if site.proteinStyles && Object.keys(site.proteinStyles).length > 0}
              <div class="protein-style-row">
                <span class="protein-label">{site.name}</span>
                <div class="style-chips">
                  {#each Object.entries(site.proteinStyles) as [protein, styles]}
                    {#each styles as style}
                      <span class="style-chip">{protein} · {style}</span>
                    {/each}
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Row: Spice gauge -->
      <div class="row-label">Spiciness</div>
      {#each sites as site}
        <div class="stat-cell" class:winner={spiceWinners.includes(site.est_id)}>
          <SpiceGauge spiceValue={site.heatOverall || 0} />
        </div>
      {/each}

      <!-- Row: Salsa count -->
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

      <!-- Row: Vibe fingerprint (anti-review aggregate) -->
      <div class="row-label">Vibes</div>
      {#each sites as site}
        <div class="stat-cell">
          <VibeFingerprint estId={site.est_id} showEmpty={true} />
        </div>
      {/each}

      <!-- Row: Hours -->
      <div class="row-label">Hours</div>
      {#each sites as site}
        <div class="hours-cell">
          <div class="hours-scale-wrapper">
            <HoursOpen startHours={site.startHours || {}} endHours={site.endHours || {}} />
          </div>
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
  {/if}
</div>

<style>
  .comparison-page {
    width: 100%;
    box-sizing: border-box;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    padding-top: 80px;
    min-height: 100vh;
    /* clip, not hidden: hidden creates a scrollport that breaks
       position: sticky for every descendant */
    overflow-x: clip;
  }

  @media (max-width: 640px) {
    .comparison-page {
      padding: 0.75rem;
      padding-top: 72px;
    }

    .page-header {
      gap: 0.5rem;
    }

    .page-title {
      font-size: 1.1rem;
    }

    .back-btn,
    .share-btn {
      padding: 6px 10px;
      font-size: 13px;
    }
  }

  /* Page-level dark background */
  :global(body.dark) .comparison-page,
  :global(.dark) .comparison-page {
    background: #0f172a;
  }

  /* Header */
  /* Sticky command bar: pins below the app header (~64px) so page actions
     and the mobile spot tabs stay reachable at any scroll depth */
  .sticky-zone {
    position: sticky;
    top: 81px; /* app header height */
    z-index: 60;
    background: var(--surface-1);
    margin: 0 -1rem 1rem;
    padding: 4px 1rem 8px;
    border-bottom: 1px solid var(--line-1);
  }

  :global(.dark) .sticky-zone {
    background: var(--surface-3);
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* At-a-glance verdicts */
  .verdict-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 1rem;
  }

  .verdict {
    flex: 1;
    min-width: 150px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 10px 14px;
    border: 1px solid var(--line-1);
    border-radius: 10px;
    background: var(--surface-2);
  }

  .verdict-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--ink-3);
  }

  .verdict-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .verdict-value {
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--accent-hover);
  }

  :global(.dark) .verdict-value {
    color: var(--accent);
  }

  .verdict-value em {
    font-style: normal;
    color: var(--ink-3);
    font-weight: 500;
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

  /* ===== DESKTOP GRID ===== */
  /* Sticky spot-name header: its own grid so it can pin below the command bar */
  .comparison-head {
    display: grid;
    position: sticky;
    top: 133px; /* app header + command bar */
    z-index: 45;
    border: 1px solid #e5e7eb;
    border-radius: 12px 12px 0 0;
    overflow: hidden;
    background: white;
  }

  :global(.dark) .comparison-head {
    border-color: #374151;
    background: #111827;
  }

  .comparison-grid {
    display: grid;
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
    background: white;
  }

  /* fr tracks bottom out at min-content: without this, a chart canvas that
     initializes before layout settles can lock a column wide (see the census
     page for the full story) */
  .comparison-grid > *,
  .comparison-head > * {
    min-width: 0;
  }

  :global(.dark) .comparison-grid {
    border-color: #374151;
    background: #111827;
  }

  .row-label {
    padding: 12px 16px;
    font-size: 11px;
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
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: #f9fafb;
  }

  .comparison-head .col-header {
    border-bottom: none;
  }

  .comparison-head .row-label {
    border-bottom: none;
  }

  .col-header:last-child {
    border-right: none;
  }

  :global(.dark) .col-header {
    background: #1f2937;
    border-bottom-color: #374151;
    border-right-color: #374151;
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
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  /* Overlay cell: one radar spanning all spot columns, taller for the legend */
  .overlay-cell {
    height: 300px;
  }

  .overlay-cell :global(.chart-wrapper) {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  .overlay-styles {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    padding-top: 4px;
  }

  .chart-cell:last-child {
    border-right: none;
  }

  :global(.dark) .chart-cell {
    border-bottom-color: #374151;
    border-right-color: #374151;
  }

  .stat-cell {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .stat-cell:last-child {
    border-right: none;
  }

  :global(.dark) .stat-cell {
    border-bottom-color: #374151;
    border-right-color: #374151;
  }

  .hours-cell {
    padding: 8px 4px;
    border-bottom: 1px solid #e5e7eb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .hours-cell:last-child {
    border-right: none;
  }

  :global(.dark) .hours-cell {
    border-bottom-color: #374151;
    border-right-color: #374151;
  }

  /* Scale hours down to fit in comparison columns */
  .hours-scale-wrapper {
    transform: scale(0.75);
    transform-origin: center center;
    width: 133%; /* compensate for scale */
  }

  .specialty-cell {
    padding: 12px;
    border-right: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
  }

  .specialty-cell:last-child {
    border-right: none;
  }

  :global(.dark) .specialty-cell {
    border-right-color: #374151;
  }

  /* Winner highlighting — uses box-shadow to avoid layout shift */
  .winner {
    background: rgba(254, 121, 93, 0.06);
    box-shadow: inset 3px 0 0 0 #FE795D;
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
    color: var(--accent-hover);
    min-width: 44px;
    flex-shrink: 0;
  }

  :global(.dark) .protein-label {
    color: var(--accent);
  }

  .style-chip {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    color: var(--accent-hover);
    background: var(--accent-soft);
    white-space: nowrap;
  }

  :global(.dark) .style-chip {
    color: var(--accent);
  }

  /* ===== MOBILE ===== */
  .mobile-tabs {
    display: flex;
    gap: 4px;
    margin-top: 8px;
    width: 100%;
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
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    white-space: nowrap;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-tap-highlight-color: transparent;
  }

  :global(.dark) .mobile-tab {
    background: #1f2937;
    border-color: #374151;
    color: #d1d5db;
  }

  .mobile-tab.tab-active {
    background: #FE795D;
    color: white;
    border-color: #FE795D;
  }

  .mobile-card {
    width: 100%;
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
    overflow: hidden;
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
    width: 100%;
    height: 200px;
    /* Prevent chart labels from forcing the container wider than the screen */
    overflow: hidden;
  }
</style>

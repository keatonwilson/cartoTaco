<script>
  import { onMount } from 'svelte';
  import { tasteProfile } from '$lib/tasteProfileStore';
  import { isAuthenticated } from '$lib/authStore';
  import { effectiveTheme } from '$lib/theme';
  import { goto } from '$app/navigation';
  import { Chart } from 'chart.js/auto';
  import RadarChart from './RadarChart.svelte';
  import SpiceGauge from './SpiceGauge.svelte';

  function goToSpot(site) {
    goto(`/?location=${site.est_id}`);
  }

  // Protein radar data
  const proteinLabels = ['Chicken', 'Beef', 'Pork', 'Fish', 'Veg'];
  $: proteinValues = $tasteProfile
    ? proteinLabels.map(l => $tasteProfile.proteinAffinities[l.toLowerCase()] || 0)
    : [];

  function fmtPct(val) {
    return Math.round(val * 100) + '%';
  }

  // ─── k-NN Scatter Chart ───────────────────────────────────────────────────
  let scatterCanvas;
  let scatterChart;

  $: isDark = $effectiveTheme === 'dark';
  $: gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  $: labelColor = isDark ? '#9ca3af' : '#6b7280';
  $: tooltipBg = isDark ? '#1f2937' : '#fff';
  $: tooltipBorder = isDark ? '#374151' : '#e5e7eb';

  function buildScatterDatasets(profile) {
    if (!profile) return [];

    const bgPoints = profile.scatterPoints.filter(p => !p.isFav && !p.isRec);
    const recPoints = profile.scatterPoints.filter(p => p.isRec);
    const favPoints = profile.scatterPoints.filter(p => p.isFav);

    return [
      // All other spots — gray background
      {
        label: 'Other spots',
        data: bgPoints.map(p => ({ x: p.heat, y: p.salsa, name: p.name })),
        pointRadius: 4,
        pointHoverRadius: 6,
        backgroundColor: isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)',
        borderColor: isDark ? 'rgba(156,163,175,0.4)' : 'rgba(156,163,175,0.5)',
        borderWidth: 1,
        pointStyle: 'circle',
      },
      // Favorited spots — blue
      {
        label: 'Your favorites',
        data: favPoints.map(p => ({ x: p.heat, y: p.salsa, name: p.name })),
        pointRadius: 7,
        pointHoverRadius: 9,
        backgroundColor: 'rgba(99,102,241,0.7)',
        borderColor: 'rgba(99,102,241,1)',
        borderWidth: 2,
        pointStyle: 'circle',
      },
      // Recommended spots — orange
      {
        label: 'Recommended for you',
        data: recPoints.map(p => ({ x: p.heat, y: p.salsa, name: p.name, similarity: p.similarity })),
        pointRadius: 8,
        pointHoverRadius: 10,
        backgroundColor: 'rgba(254,121,93,0.8)',
        borderColor: '#FE795D',
        borderWidth: 2,
        pointStyle: 'rectRounded',
      },
      // User taste centroid — star
      {
        label: 'Your taste',
        data: [{ x: profile.userHeat, y: profile.userSalsa, name: 'Your Taste' }],
        pointRadius: 12,
        pointHoverRadius: 14,
        backgroundColor: 'rgba(254,200,93,0.9)',
        borderColor: '#e5a000',
        borderWidth: 2,
        pointStyle: 'star',
      },
    ];
  }

  function createChart(profile) {
    if (!scatterCanvas || !profile) return;
    if (scatterChart) {
      scatterChart.destroy();
      scatterChart = null;
    }

    scatterChart = new Chart(scatterCanvas, {
      type: 'scatter',
      data: { datasets: buildScatterDatasets(profile) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 14,
              font: { size: 11 },
              color: labelColor,
              usePointStyle: true,
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 1,
            titleColor: isDark ? '#f9fafb' : '#111827',
            bodyColor: labelColor,
            padding: 10,
            callbacks: {
              label(ctx) {
                const { name, similarity } = ctx.raw;
                let line = name ? `${name}` : '';
                if (typeof similarity === 'number') line += ` — ${similarity}% match`;
                return line;
              },
              title() { return ''; }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Spice Level (0–10)', color: labelColor, font: { size: 11 } },
            min: 0,
            max: 10,
            grid: { color: gridColor },
            ticks: { color: labelColor, stepSize: 2, font: { size: 10 } }
          },
          y: {
            title: { display: true, text: 'Salsa Count', color: labelColor, font: { size: 11 } },
            min: 0,
            grid: { color: gridColor },
            ticks: { color: labelColor, font: { size: 10 } }
          }
        }
      }
    });
  }

  onMount(() => {
    if ($tasteProfile && scatterCanvas) createChart($tasteProfile);
    return () => { if (scatterChart) scatterChart.destroy(); };
  });

  // Rebuild chart when profile data or theme changes
  $: if (scatterCanvas && $tasteProfile) {
    createChart($tasteProfile);
  }

  $: if (scatterChart) {
    scatterChart.data.datasets = buildScatterDatasets($tasteProfile);
    scatterChart.options.plugins.legend.labels.color = labelColor;
    scatterChart.options.plugins.tooltip.backgroundColor = tooltipBg;
    scatterChart.options.plugins.tooltip.borderColor = tooltipBorder;
    scatterChart.options.scales.x.grid.color = gridColor;
    scatterChart.options.scales.x.ticks.color = labelColor;
    scatterChart.options.scales.x.title.color = labelColor;
    scatterChart.options.scales.y.grid.color = gridColor;
    scatterChart.options.scales.y.ticks.color = labelColor;
    scatterChart.options.scales.y.title.color = labelColor;
    scatterChart.update();
  }
</script>

<div class="taste-profile">
  {#if !$isAuthenticated}
    <div class="empty-state">
      <h3 class="empty-title">Personal Taste Profile</h3>
      <p class="empty-text">Sign in and favorite some spots to discover your taco personality!</p>
      <button class="cta-btn" on:click={() => goto('/login')}>Sign In</button>
    </div>
  {:else if !$tasteProfile}
    <div class="empty-state">
      <h3 class="empty-title">Personal Taste Profile</h3>
      <p class="empty-text">Favorite at least one spot to start building your taste profile.</p>
      <button class="cta-btn" on:click={() => goto('/')}>Explore the Map</button>
    </div>
  {:else}
    <!-- Archetype Badge -->
    <div class="archetype-section">
      <div class="archetype-badge">
        <span class="archetype-label">Your Taco Personality</span>
        <h2 class="archetype-name">{$tasteProfile.archetype.label}</h2>
        <p class="archetype-desc">{$tasteProfile.archetype.desc}</p>
        <div class="archetype-score-bar">
          <div class="archetype-score-fill" style="width: {$tasteProfile.archetype.finalScore}%"></div>
        </div>
        <span class="archetype-score-label">{$tasteProfile.archetype.finalScore}% match</span>
      </div>
      {#if $tasteProfile.runnerUp}
        <div class="runner-up">
          <span class="runner-up-label">Close second:</span>
          <span class="runner-up-name">{$tasteProfile.runnerUp.label}</span>
          <span class="runner-up-score">{$tasteProfile.runnerUp.finalScore}%</span>
        </div>
      {/if}
      <span class="favorites-stat">Based on {$tasteProfile.favoritesCount} favorite{$tasteProfile.favoritesCount !== 1 ? 's' : ''}</span>
    </div>

    <!-- Protein Affinities -->
    <div class="profile-section">
      <h3 class="section-title">Protein Preferences</h3>
      <div class="radar-container">
        <RadarChart labels={proteinLabels} data={proteinValues} />
      </div>
      <div class="protein-bars">
        {#each Object.entries($tasteProfile.proteinAffinities).sort((a, b) => b[1] - a[1]) as [protein, pct]}
          <div class="protein-bar-row">
            <span class="protein-name">{protein}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {pct}%"></div>
            </div>
            <span class="protein-pct">{pct}%</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Spice & Salsa stats -->
    <div class="profile-section stats-row">
      <div class="stat-card">
        <h3 class="section-title">Spice Tolerance</h3>
        <SpiceGauge spiceValue={$tasteProfile.avgSpice} />
      </div>
      <div class="stat-card">
        <h3 class="section-title">Salsa Preference</h3>
        <div class="salsa-stat">
          <span class="salsa-number">{$tasteProfile.avgSalsaCount}</span>
          <span class="salsa-label">avg salsas at your favorites</span>
        </div>
      </div>
    </div>

    <!-- Type Preferences -->
    <div class="profile-section">
      <h3 class="section-title">Spot Type Preferences</h3>
      <div class="type-bars">
        <div class="type-row">
          <span class="type-name">Restaurant</span>
          <div class="bar-track"><div class="bar-fill type-fill" style="width: {$tasteProfile.typePrefs.restaurant * 100}%"></div></div>
          <span class="type-pct">{fmtPct($tasteProfile.typePrefs.restaurant)}</span>
        </div>
        <div class="type-row">
          <span class="type-name">Stand</span>
          <div class="bar-track"><div class="bar-fill type-fill" style="width: {$tasteProfile.typePrefs.stand * 100}%"></div></div>
          <span class="type-pct">{fmtPct($tasteProfile.typePrefs.stand)}</span>
        </div>
        <div class="type-row">
          <span class="type-name">Truck</span>
          <div class="bar-track"><div class="bar-fill type-fill" style="width: {$tasteProfile.typePrefs.truck * 100}%"></div></div>
          <span class="type-pct">{fmtPct($tasteProfile.typePrefs.truck)}</span>
        </div>
      </div>
    </div>

    <!-- k-NN Taste Map -->
    <div class="profile-section">
      <h3 class="section-title">Taste Map</h3>
      <p class="section-subtitle">Where your taste lands in spice &amp; salsa space. Recommended spots are nearest neighbors.</p>
      <div class="scatter-container">
        <canvas bind:this={scatterCanvas}></canvas>
      </div>
    </div>

    <!-- Recommendations -->
    {#if $tasteProfile.recommendations.length > 0}
      <div class="profile-section">
        <h3 class="section-title">Recommended for You</h3>
        <p class="section-subtitle">Closest matches to your taste profile via k-NN</p>
        <div class="rec-list">
          {#each $tasteProfile.recommendations as site}
            <button class="rec-item" on:click={() => goToSpot(site)}>
              <div class="rec-info">
                <span class="rec-name">{site.name}</span>
                <span class="rec-type">{site.type}</span>
              </div>
              <div class="rec-right">
                <span class="rec-match">{site.similarity}% match</span>
                <span class="rec-arrow">&rarr;</span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .taste-profile {
    width: 100%;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 2rem 1rem;
  }

  .empty-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  :global(.dark) .empty-title {
    color: #f9fafb;
  }

  .empty-text {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  :global(.dark) .empty-text {
    color: #9ca3af;
  }

  .cta-btn {
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: #FE795D;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .cta-btn:hover {
    background: #e55a3c;
  }

  /* Archetype */
  .archetype-section {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .archetype-badge {
    padding: 1.25rem;
    background: linear-gradient(135deg, #fff5f2 0%, #ffe4de 100%);
    border: 2px solid #FE795D;
    border-radius: 12px;
    margin-bottom: 0.5rem;
  }

  :global(.dark) .archetype-badge {
    background: linear-gradient(135deg, rgba(254, 121, 93, 0.1) 0%, rgba(254, 121, 93, 0.05) 100%);
  }

  .archetype-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #FE795D;
  }

  .archetype-name {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1f2937;
    margin: 0.25rem 0;
  }

  :global(.dark) .archetype-name {
    color: #f9fafb;
  }

  .archetype-desc {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  :global(.dark) .archetype-desc {
    color: #9ca3af;
  }

  .archetype-score-bar {
    height: 4px;
    background: rgba(254, 121, 93, 0.2);
    border-radius: 2px;
    margin: 0.5rem auto 0.25rem;
    width: 80%;
    overflow: hidden;
  }

  .archetype-score-fill {
    height: 100%;
    background: #FE795D;
    border-radius: 2px;
    transition: width 0.6s ease;
  }

  .archetype-score-label {
    font-size: 11px;
    color: #FE795D;
    font-weight: 600;
  }

  .runner-up {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 0.5rem;
    font-size: 12px;
  }

  .runner-up-label {
    color: #9ca3af;
  }

  .runner-up-name {
    font-weight: 600;
    color: #6b7280;
  }

  :global(.dark) .runner-up-name {
    color: #d1d5db;
  }

  .runner-up-score {
    font-size: 11px;
    color: #9ca3af;
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 999px;
  }

  :global(.dark) .runner-up-score {
    background: #374151;
  }

  .favorites-stat {
    font-size: 12px;
    color: #9ca3af;
    display: block;
    margin-top: 0.5rem;
  }

  /* Sections */
  .profile-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
  }

  :global(.dark) .profile-section {
    background: #111827;
    border-color: #374151;
  }

  .section-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    margin: 0 0 0.25rem 0;
  }

  :global(.dark) .section-title {
    color: #9ca3af;
  }

  .section-subtitle {
    font-size: 12px;
    color: #9ca3af;
    margin: 0 0 0.75rem 0;
  }

  /* Radar chart */
  .radar-container {
    height: 180px;
    margin-bottom: 0.75rem;
  }

  /* Protein bars */
  .protein-bars,
  .type-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .protein-bar-row,
  .type-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .protein-name,
  .type-name {
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
    color: #374151;
    width: 65px;
    flex-shrink: 0;
  }

  :global(.dark) .protein-name,
  :global(.dark) .type-name {
    color: #d1d5db;
  }

  .bar-track {
    flex: 1;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  :global(.dark) .bar-track {
    background: #374151;
  }

  .bar-fill {
    height: 100%;
    background: #FE795D;
    border-radius: 4px;
    transition: width 0.5s ease;
    min-width: 2px;
  }

  .type-fill {
    background: #FF9800;
  }

  .protein-pct,
  .type-pct {
    font-size: 12px;
    font-weight: 600;
    color: #FE795D;
    width: 36px;
    text-align: right;
    flex-shrink: 0;
  }

  /* Stats row */
  .stats-row {
    display: flex;
    gap: 1rem;
  }

  .stat-card {
    flex: 1;
    text-align: center;
  }

  .salsa-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 0;
  }

  .salsa-number {
    font-size: 2rem;
    font-weight: 800;
    color: #FE795D;
    line-height: 1;
  }

  .salsa-label {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 4px;
  }

  /* Scatter chart */
  .scatter-container {
    height: 280px;
    position: relative;
  }

  /* Recommendations */
  .rec-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rec-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
    text-align: left;
  }

  :global(.dark) .rec-item {
    background: #1f2937;
    border-color: #374151;
  }

  .rec-item:hover {
    border-color: #FE795D;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(254, 121, 93, 0.15);
  }

  .rec-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rec-name {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  :global(.dark) .rec-name {
    color: #f9fafb;
  }

  .rec-type {
    font-size: 11px;
    color: #9ca3af;
  }

  .rec-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .rec-match {
    font-size: 12px;
    font-weight: 700;
    color: #FE795D;
    background: rgba(254, 121, 93, 0.1);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .rec-arrow {
    color: #FE795D;
    font-size: 16px;
    font-weight: 600;
  }

  /* Mobile: stack stats vertically */
  @media (max-width: 480px) {
    .stats-row {
      flex-direction: column;
    }
  }
</style>

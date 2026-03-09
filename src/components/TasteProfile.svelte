<script>
  import { tasteProfile } from '$lib/tasteProfileStore';
  import { isAuthenticated } from '$lib/authStore';
  import { goto } from '$app/navigation';
  import RadarChart from './RadarChart.svelte';
  import SpiceGauge from './SpiceGauge.svelte';
  import { mapInstance } from '$lib/mapStore';
  import { flyToSite } from '$lib/mapping';
  import { selectedSite } from '$lib/stores';

  function goToSpot(site) {
    goto('/');
    // Small delay to let the map page mount
    setTimeout(() => {
      const map = $mapInstance;
      if (map) {
        selectedSite.set(site);
        flyToSite(map, site);
      }
    }, 300);
  }

  // Protein labels for radar chart
  const proteinLabels = ['Chicken', 'Beef', 'Pork', 'Fish', 'Veg'];
  $: proteinValues = $tasteProfile
    ? proteinLabels.map(l => $tasteProfile.proteinAffinities[l.toLowerCase()] || 0)
    : [];

  // Format type preference as percentage string
  function fmtPct(val) {
    return Math.round(val * 100) + '%';
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
      </div>
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

    <!-- Spice & Salsa -->
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

    <!-- Recommendations -->
    {#if $tasteProfile.recommendations.length > 0}
      <div class="profile-section">
        <h3 class="section-title">Recommended for You</h3>
        <p class="rec-subtitle">Spots that match your taste profile</p>
        <div class="rec-list">
          {#each $tasteProfile.recommendations as site}
            <button class="rec-item" on:click={() => goToSpot(site)}>
              <div class="rec-info">
                <span class="rec-name">{site.name}</span>
                <span class="rec-type">{site.type}</span>
              </div>
              <span class="rec-arrow">&rarr;</span>
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

  .favorites-stat {
    font-size: 12px;
    color: #9ca3af;
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
    margin: 0 0 0.75rem 0;
  }

  :global(.dark) .section-title {
    color: #9ca3af;
  }

  /* Radar chart */
  .radar-container {
    height: 180px;
    margin-bottom: 0.75rem;
  }

  /* Protein bars */
  .protein-bars, .type-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .protein-bar-row, .type-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .protein-name, .type-name {
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

  .protein-pct, .type-pct {
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

  /* Recommendations */
  .rec-subtitle {
    font-size: 12px;
    color: #9ca3af;
    margin: -0.5rem 0 0.75rem 0;
  }

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

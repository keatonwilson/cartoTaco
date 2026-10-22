<script>
  // The spot card body, the same on the desktop panel and the mobile sheet.
  // The name, status and actions live in SpotHeader above it. One reading
  // column: hours and the description first, then the at-a-glance tiles,
  // what they serve, vibe votes, and the specialties carousel. Components
  // are sized to fill the column so numbers and labels read at a glance.
  import RadarChart from "./RadarChart.svelte";
  import HoursOpen from "./HoursOpen.svelte";
  import SpecCarousel from "./SpecCarousel.svelte";
  import VibeVotes from "./VibeVotes.svelte";
  import VibeFingerprint from "./VibeFingerprint.svelte";
  import ClosedBanner from "./ClosedBanner.svelte";
  import SpotStats from "./SpotStats.svelte";
  import { selectedSite } from "$lib/stores";
  import { radarMax } from "$lib/chartTheme";
  import { todayHours, minuteClock } from "$lib/hours";

  // Local state
  let showLongDescription = false;
  /** Which radar shows */
  let radarView = 'menu';

  // Closed spots keep their recorded data as a historical record, but lose the
  // affordances that assume you might go: vibe voting, comparison, directions.
  $: isClosed = !!$selectedSite?.isClosed;

  // Radar scales fit this spot's own values so the polygon fills the plot;
  // cross-spot comparison happens on /compare, which shares a scale there
  $: menuRadarMax = radarMax($selectedSite?.topFiveMenuValues);
  $: proteinRadarMax = radarMax($selectedSite?.topFiveProteinValues);

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  $: menuLabels = ($selectedSite?.topFiveMenuItems || []).map(capitalize);
  $: proteinLabels = ($selectedSite?.topFiveProteinItems || []).map(capitalize);


  $: today = $selectedSite
    ? todayHours($selectedSite.startHours || [], $selectedSite.endHours || [], $minuteClock)
    : null;

  let errorState = false;
  let errorMessage = "Unable to display data";

  function toggleLongDescription() {
    showLongDescription = !showLongDescription;
  }
</script>

{#if !$selectedSite}
  <div id="error-content">
    <p>No location selected</p>
  </div>
{:else if errorState}
  <div id="error-content">
    <p>{errorMessage}</p>
  </div>
{:else}
  <!-- Each section is a labelled band split by a hairline; --i staggers the
       entrance -->
  <div id="popup-content" class="card-body">
    {#if isClosed}
      <ClosedBanner closedAt={$selectedSite.closedAt} />
    {/if}

    <section class="card-section" style="--i:0">
      <div class="card-label-row">
        <h3 class="card-label">Hours</h3>
        {#if today}
          <span class="today">Today <strong>{today}</strong></span>
        {/if}
      </div>
      <HoursOpen
        size="lg"
        showTitle={false}
        showStatus={false}
        startHours={$selectedSite.startHours || {}}
        endHours={$selectedSite.endHours || {}}
      />
    </section>

    <section class="card-section" style="--i:1">
      <h3 class="card-label">About</h3>
      <p class="card-lede">{$selectedSite.shortDescription || 'No description available'}</p>
      {#if $selectedSite.longDescription}
        <div class="long-description" class:visible={showLongDescription}>
          <p class="card-long">{$selectedSite.longDescription}</p>
        </div>
        <button class="expand-button" on:click={toggleLongDescription} aria-expanded={showLongDescription}>
          {showLongDescription ? 'Show less' : 'Read more'}
        </button>
      {/if}
    </section>

    <section class="card-section" style="--i:2">
      <SpotStats site={$selectedSite} />
    </section>

    <section class="card-section" style="--i:3">
      <div class="card-label-row">
        <h3 class="card-label">What they serve</h3>
        <div class="radar-toggle" role="group" aria-label="Chart">
          <button type="button" aria-pressed={radarView === 'menu'} on:click={() => (radarView = 'menu')}>Menu</button>
          <button type="button" aria-pressed={radarView === 'protein'} on:click={() => (radarView = 'protein')}>Protein</button>
        </div>
      </div>
      <div class="card-radar">
        {#if radarView === 'menu'}
          <RadarChart labels={menuLabels} data={$selectedSite.topFiveMenuValues || []} max={menuRadarMax} labelSize={13} showValues />
        {:else}
          <RadarChart labels={proteinLabels} data={$selectedSite.topFiveProteinValues || []} max={proteinRadarMax} labelSize={13} showValues />
        {/if}
      </div>
      <p class="card-note">Share of what they serve, by item</p>
      {#if radarView === 'protein' && $selectedSite.proteinStyles && Object.keys($selectedSite.proteinStyles).length > 0}
        <div class="protein-styles">
          {#each Object.entries($selectedSite.proteinStyles) as [protein, styles]}
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
    </section>

    {#if !isClosed}
      <section class="card-section" style="--i:4">
        <h3 class="card-label">Vibe check</h3>
        <p class="card-note">Tap what this spot does well. Everyone's votes build its vibe fingerprint.</p>
        <VibeVotes estId={$selectedSite.est_id} />
        <VibeFingerprint estId={$selectedSite.est_id} />
      </section>
    {/if}
    <section class="card-section" style="--i:5">
      <h3 class="card-label">Specialties</h3>
      {#if $selectedSite.specialties && $selectedSite.specialties.length > 0}
        <div class="specialties">
          <SpecCarousel specialties={$selectedSite.specialties} />
        </div>
      {:else}
        <p class="card-note">No specialty information for this spot yet.</p>
      {/if}
    </section>
  </div>
{/if}

<style>
  #error-content {
    padding: 20px;
    text-align: center;
    background-color: #ffe6e6;
    border: 1px solid #ffcccc;
    border-radius: 8px;
    margin: 10px;
  }
  :global(.dark) #error-content {
    background-color: #7f1d1d;
    border-color: #991b1b;
    color: #fecaca;
  }
  .long-description {
    display: none;
    margin-top: 6px;
  }
  .long-description.visible {
    display: block;
  }
  .protein-styles {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }
  .protein-style-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .protein-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: capitalize;
    color: var(--accent-hover);
    min-width: 52px;
    flex-shrink: 0;
  }
  :global(.dark) .protein-label {
    color: var(--accent);
  }
  .style-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--accent);
    color: var(--accent-hover);
    background: var(--accent-soft);
    white-space: nowrap;
  }
  :global(.dark) .style-chip {
    color: var(--accent);
  }

  #popup-content {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .card-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 0;
    border-top: 1px solid var(--line-1);
    animation: card-section-in 0.36s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }

  .card-section:first-of-type {
    border-top: none;
    padding-top: 8px;
  }

  @keyframes card-section-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-section {
      animation: none;
    }
  }

  /* Mono caps label, the Salsa Atlas kicker voice */
  .card-label {
    margin: 0;
    font: 600 12px/1.3 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .card-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .card-lede {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    color: var(--ink-1);
    text-wrap: pretty;
  }

  .card-long {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--ink-2);
  }

  .card-note {
    margin: -4px 0 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink-3);
  }

  .expand-button {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent-hover);
    font: 600 14px/1.4 var(--font-text);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .today {
    font-size: 15px;
    color: var(--ink-2);
  }

  .today strong {
    color: var(--ink-1);
  }

  /* ── Specialties: the carousel, with cards filling most of the column ── */
  .specialties :global(.carousel-item) {
    flex-basis: 85%;
  }

  .specialties :global(.card-title) {
    font-size: 17px;
  }

  .specialties :global(.card-description) {
    font-size: 14px;
    line-height: 1.5;
  }

  /* ── Radar ── */
  .card-radar {
    height: 340px;
  }

  .radar-toggle {
    display: inline-flex;
    padding: 3px;
    border-radius: 999px;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
  }

  .radar-toggle button {
    padding: 5px 14px;
    border: none;
    border-radius: 999px;
    background: transparent;
    font: 600 14px/1.4 var(--font-text);
    color: var(--ink-2);
    cursor: pointer;
  }

  .radar-toggle button[aria-pressed='true'] {
    background: var(--surface-1);
    color: var(--ink-1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }

  .radar-toggle button:focus-visible,
  .expand-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Bigger prep-style chips under the protein radar */
  .card-body .protein-label {
    font-size: 14px;
    min-width: 64px;
  }

  .card-body .style-chip {
    font-size: 13px;
    padding: 3px 10px;
  }
</style>

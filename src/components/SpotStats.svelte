<script>
  // At-a-glance tiles for the spot card: heat, salsas and tortillas, each sized
  // to fill its tile so the numbers read from across the room. Two columns when
  // the card is wide enough, stacked otherwise; tortillas always span the row.
  import ContextStrip from './ContextStrip.svelte';
  import SalsaLineup from './SalsaLineup.svelte';
  import IconHighlight from './IconHighlight.svelte';
  import HandmadeBadge from './HandmadeBadge.svelte';
  import { summaryStats, distributionStats, distributionPool } from '$lib/stores';
  import { SEQUENTIAL } from '$lib/chartTheme';
  import { describeHeat } from '$lib/dataWrangling';
  import { contextLine } from '$lib/distribution';

  /** processedSite */
  export let site;

  const TORTILLA_WORDS = { corn: 'Corn', flour: 'Flour', both: 'Corn & flour' };
  // Same ladder ramp as SpiceGauge: the two near-white steps are dropped
  const RAMP = SEQUENTIAL.slice(2);
  const notchColor = (i) => RAMP[Math.round((i / 9) * (RAMP.length - 1))];

  $: heat = site.heatOverall || 0;
  $: filled = Math.max(0, Math.min(10, Math.round(heat)));
  $: stats = $distributionStats.get(site.est_id);
  $: heatContext = stats
    ? contextLine('heat', stats.heatPercentile, stats.heatPercentileAbove, stats.heatTied)
    : null;
  $: salsaContext = stats
    ? contextLine('salsa', stats.salsaPercentile, stats.salsaPercentileAbove, stats.salsaTied)
    : null;

  $: salsas = site.salsaCount || 0;
  $: salsaMax = Math.max($summaryStats.maxSalsaNum || 0, salsas, 1);
  $: salsaAvg = $summaryStats.avgSalsaNum || 0;

  $: tortilla = String(site.tortillaType || '').toLowerCase();
</script>

<div class="stat-grid">
  <section class="tile">
    <h4 class="tile-label">Heat</h4>
    <div class="hero">
      <span class="num">{heat}</span><span class="denom">/10</span>
      <span class="word">{describeHeat(heat)}</span>
    </div>
    <div
      class="ladder"
      role="meter"
      aria-valuemin="0"
      aria-valuemax="10"
      aria-valuenow={heat}
      aria-label="Heat level {heat} out of 10, {describeHeat(heat)}"
    >
      {#each Array(10) as _, i}
        <span class="notch" style:background={i < filled ? notchColor(i) : null}></span>
      {/each}
    </div>
    {#if heatContext}
      <p class="context">{heatContext}</p>
    {/if}
    <!-- Closed spots aren't in the pool, so they'd ring a bin that doesn't count them -->
    {#if stats}
      <div class="strip">
        <ContextStrip
          values={$distributionPool.heats}
          value={heat}
          min={0}
          max={10}
          binLabel={(v) => `at heat ${v}`}
          label="Tucson spots by heat — this one ringed"
        />
      </div>
    {/if}
  </section>

  <section class="tile">
    <h4 class="tile-label">Salsas</h4>
    <div class="hero">
      <span class="num">{salsas}</span>
      <span class="word">{salsas === 1 ? 'salsa' : 'salsas'}</span>
    </div>
    <div
      class="bar"
      role="img"
      aria-label="{salsas} salsas; the city average is {Math.round(salsaAvg)} and the most is {salsaMax}"
    >
      <span class="fill" style:width="{(salsas / salsaMax) * 100}%"></span>
      <span class="avg" style:left="{(salsaAvg / salsaMax) * 100}%"></span>
    </div>
    <p class="scale">City average {Math.round(salsaAvg)} · most {salsaMax}</p>
    {#if salsaContext}
      <p class="context">{salsaContext}</p>
    {/if}
    {#if stats}
      <div class="strip">
        <ContextStrip
          values={$distributionPool.salsas}
          value={salsas}
          min={0}
          max={$summaryStats.maxSalsaNum || null}
          binLabel={(v) => `with ${v} ${v === 1 ? 'salsa' : 'salsas'}`}
          label="Tucson spots by salsa count — this one ringed"
        />
      </div>
    {/if}
    <div class="lineup">
      <SalsaLineup salsaVarieties={site.salsaVarieties || []} otherSalsas={site.otherSalsas || []} />
    </div>
  </section>

  <section class="tile wide">
    <h4 class="tile-label">Tortillas</h4>
    <div class="tortilla-row">
      <IconHighlight type="tortilla" data={tortilla || 'unknown'} />
      <span class="word">{TORTILLA_WORDS[tortilla] || 'Not recorded'}</span>
      {#if site.handmadeTortilla}
        <HandmadeBadge />
      {/if}
    </div>
  </section>
</div>

<style>
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--line-1);
    background: var(--surface-2);
  }

  .tile.wide {
    grid-column: 1 / -1;
  }

  .tile-label {
    margin: 0;
    font: 600 12px/1.3 var(--font-mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .hero {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 8px;
    line-height: 1;
  }

  .num {
    font-family: var(--font-display);
    font-size: 48px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--ink-1);
  }

  .denom {
    margin-left: -6px;
    font-size: 18px;
    font-weight: 600;
    color: var(--ink-3);
  }

  .word {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink-1);
  }

  .ladder {
    display: flex;
    gap: 4px;
  }

  .notch {
    flex: 1;
    height: 16px;
    border-radius: 3px;
    background: var(--line-1);
  }

  .context,
  .scale {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--ink-2);
  }

  .scale {
    font-size: 13px;
    color: var(--ink-3);
  }

  /* ContextStrip is sized for small cards; let it span the tile */
  .strip :global(.strip-track) {
    max-width: none;
  }

  .strip :global(.context-strip) {
    align-items: stretch;
  }

  .strip :global(.strip-label) {
    font-size: 12px;
  }

  .bar {
    position: relative;
    height: 16px;
    border-radius: 4px;
    background: var(--line-1);
  }

  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 4px;
    background: var(--accent);
  }

  /* City-average tick */
  .avg {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--ink-1);
  }

  .lineup :global(.salsa-chip) {
    font-size: 13px;
    padding: 4px 11px;
  }

  .tortilla-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 16px;
  }

  /* IconHighlight and HandmadeBadge carry their own top/bottom margins for
     the old stacked card; zero them so the row centres on one line */
  .tile .tortilla-row :global(.icons) {
    margin: 0;
    gap: 12px;
  }

  .tile .tortilla-row :global(.handmade-badge) {
    margin: 0;
  }

  .tortilla-row :global(.tortilla-icon) {
    width: 44px;
    height: 44px;
    max-width: 44px;
    max-height: 44px;
  }
</style>

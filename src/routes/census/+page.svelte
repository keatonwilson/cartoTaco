<script>
  // Tucson Taco Census — public city-wide stats dashboard (N2).
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import * as echarts from 'echarts';
  import { censusStats, DAY_LABELS } from '$lib/censusStore';
  import { isLoading } from '$lib/stores';
  import { effectiveTheme } from '$lib/theme';
  import { accent, SEQUENTIAL, chartInk, tooltipStyle, baseTextStyle } from '$lib/chartTheme';
  import { toast } from '$lib/toastStore';
  import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
  import LoadingState from '../../components/LoadingState.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  $: isDark = $effectiveTheme === 'dark';
  $: stats = $censusStats;

  // Hero numbers count up on load (skipped for reduced-motion users)
  const reduceMotion =
    browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tweenOpts = { duration: reduceMotion ? 0 : 900, easing: cubicOut };
  const spotsTween = tweened(0, tweenOpts);
  const openTween = tweened(0, tweenOpts);
  const heatTween = tweened(0, tweenOpts);
  const salsasTween = tweened(0, tweenOpts);

  $: if (stats) {
    spotsTween.set(stats.totalSpots);
    openTween.set(stats.openNow);
    heatTween.set(stats.avgHeat);
    salsasTween.set(stats.totalSalsas);
  }

  function label(item) {
    return item.charAt(0).toUpperCase() + item.slice(1);
  }

  async function shareCensus() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Tucson Taco Census', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Census link copied to clipboard');
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }

  // ─── ECharts instances ────────────────────────────────────────────────────
  let menuEl, proteinEl, heatEl, growthEl;
  let charts = {};

  function initChart(key, el) {
    if (!el || charts[key]) return;
    charts[key] = echarts.init(el);
    const ro = new ResizeObserver(() => charts[key]?.resize());
    ro.observe(el);
  }

  function axisCommon(ink) {
    return {
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: ink.grid } },
      axisLabel: { ...baseTextStyle(isDark), fontSize: 10 }
    };
  }

  function menuOption(s) {
    const ink = chartInk(isDark);
    const rows = [...s.menuPrevalence].reverse(); // horizontal bars render bottom→top
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 40, top: 4, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(isDark),
        trigger: 'item',
        confine: true,
        formatter: (p) => `<b>${p.name}</b>: ${rows[p.dataIndex].count} of ${s.totalSpots} spots`
      },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: {
        type: 'category',
        data: rows.map((r) => label(r.item)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...baseTextStyle(isDark), fontSize: 11 }
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => r.pct),
          barWidth: 10,
          itemStyle: { color: accent(isDark), borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            ...baseTextStyle(isDark),
            fontSize: 10
          }
        }
      ]
    };
  }

  function proteinOption(s) {
    const ink = chartInk(isDark);
    const rows = [...s.proteins].reverse();
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 40, top: 4, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(isDark),
        trigger: 'item',
        confine: true,
        formatter: (p) => `<b>${p.name}</b>: ${rows[p.dataIndex].count} of ${s.totalSpots} spots`
      },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: {
        type: 'category',
        data: rows.map((r) => label(r.protein)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...baseTextStyle(isDark), fontSize: 11 }
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => r.pct),
          barWidth: 12,
          itemStyle: { color: accent(isDark), borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            ...baseTextStyle(isDark),
            fontSize: 10
          }
        }
      ]
    };
  }

  function heatOption(s) {
    const ink = chartInk(isDark);
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 12, top: 18, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(isDark),
        trigger: 'item',
        confine: true,
        formatter: (p) => `Heat ${p.name}: <b>${p.value}</b> spot${p.value === 1 ? '' : 's'}`
      },
      xAxis: {
        type: 'category',
        data: s.heatHistogram.map((b) => b.heat),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...baseTextStyle(isDark), fontSize: 10 }
      },
      yAxis: { ...axisCommon(ink), type: 'value', minInterval: 1 },
      series: [
        {
          type: 'bar',
          data: s.heatHistogram.map((b) => ({
            value: b.count,
            // Each bin wears its own ramp step — the axis IS heat
            itemStyle: {
              color: SEQUENTIAL[2 + Math.round((b.heat / 10) * 6)],
              borderRadius: [4, 4, 0, 0]
            }
          })),
          barWidth: 12,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: ink.label, width: 1.5, type: 'dashed' },
            label: {
              formatter: `city avg ${s.avgHeat.toFixed(1)}`,
              ...baseTextStyle(isDark),
              fontSize: 9
            },
            data: [{ xAxis: Math.round(s.avgHeat) }]
          }
        }
      ]
    };
  }

  function growthOption(s) {
    const ink = chartInk(isDark);
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 16, top: 10, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipStyle(isDark),
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'line', lineStyle: { color: ink.label } },
        formatter: (params) => {
          const p = params[0];
          const d = new Date(p.value[0]);
          return `${d.toLocaleDateString()}: <b>${p.value[1]}</b> spots on the map`;
        }
      },
      xAxis: {
        type: 'time',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { ...baseTextStyle(isDark), fontSize: 10 }
      },
      yAxis: { ...axisCommon(ink), type: 'value', minInterval: 1 },
      series: [
        {
          type: 'line',
          step: 'end',
          data: s.growth.map((g) => [g.date, g.count]),
          symbol: 'none',
          lineStyle: { width: 2, color: accent(isDark) },
          areaStyle: { color: accent(isDark), opacity: 0.08 }
        }
      ]
    };
  }

  onMount(() => {
    return () => {
      Object.values(charts).forEach((c) => c?.dispose());
      charts = {};
    };
  });

  // (Re)build all charts when data or theme changes
  $: if (browser && stats) {
    initChart('menu', menuEl);
    initChart('protein', proteinEl);
    initChart('heat', heatEl);
    initChart('growth', growthEl);
    const dark = isDark; // referenced so theme flips retrigger this block
    charts.menu?.setOption(menuOption(stats), { notMerge: true });
    charts.protein?.setOption(proteinOption(stats), { notMerge: true });
    charts.heat?.setOption(heatOption(stats), { notMerge: true });
    if (stats.growth.length > 1) {
      charts.growth?.setOption(growthOption(stats), { notMerge: true });
    }
  }

  function gridColor(count, max) {
    if (count === 0) return 'var(--line-1)';
    return SEQUENTIAL[1 + Math.round((count / max) * 7)];
  }
</script>

<svelte:head>
  <title>Tucson Taco Census — CartoTaco</title>
  <meta name="description" content="City-wide taco statistics for Tucson, AZ: what's served, how hot it runs, and when you can get a taco." />
</svelte:head>

<div class="census-page">
  <div class="page-header">
    <button class="back-btn" on:click={() => goto('/')}>&larr; Back to Map</button>
    <h1 class="page-title">Tucson Taco Census</h1>
    <button class="share-btn" on:click={shareCensus}>
      {#if browser}<ShareNetwork size={14} weight="bold" />{/if}
      Share
    </button>
  </div>

  {#if $isLoading || !browser}
    <LoadingState message="Counting Tucson's tacos…" />
  {:else if !stats}
    <EmptyState
      emoji="📉"
      title="No census data yet"
      message="The count starts as soon as the map data loads. Check back in a moment."
    />
  {:else}
    <p class="census-intro">
      Everything we know about tacos in Tucson, in one page — computed live from
      {stats.totalSpots} mapped spots.
    </p>

    <!-- Hero stat tiles -->
    <div class="hero-tiles">
      <div class="tile">
        <span class="tile-number stat-number">{Math.round($spotsTween)}</span>
        <span class="tile-label">spots on the map</span>
      </div>
      <div class="tile">
        <span class="tile-number stat-number">{Math.round($openTween)}</span>
        <span class="tile-label">open right now</span>
      </div>
      <div class="tile">
        <span class="tile-number stat-number">{$heatTween.toFixed(1)}</span>
        <span class="tile-label">avg heat / 10</span>
      </div>
      <div class="tile">
        <span class="tile-number stat-number">{Math.round($salsasTween)}</span>
        <span class="tile-label">salsas citywide</span>
      </div>
      {#if stats.newest}
        <div class="tile tile-wide">
          <span class="tile-number tile-name">{stats.newest.name}</span>
          <span class="tile-label">newest spot</span>
        </div>
      {/if}
    </div>

    <div class="census-grid">
      <section class="census-section">
        <h2 class="section-title">What Tucson serves</h2>
        <p class="section-sub">Share of spots offering each menu item</p>
        <div
          class="chart menu-chart"
          style="height: {Math.max(220, stats.menuPrevalence.length * 36 + 30)}px"
          bind:this={menuEl}
        ></div>
      </section>

      <div class="census-col">
        <section class="census-section">
          <h2 class="section-title">Protein leaderboard</h2>
          <p class="section-sub">Share of spots serving each protein</p>
          <div class="chart protein-chart" bind:this={proteinEl}></div>
        </section>

        <section class="census-section">
          <h2 class="section-title">How hot does Tucson run?</h2>
          <p class="section-sub">Spots by overall heat level</p>
          <div class="chart heat-chart" bind:this={heatEl}></div>
        </section>

        <section class="census-section">
          <h2 class="section-title">Tortilla politics</h2>
          <div class="tortilla-row">
            <div class="tortilla-stat">
              <span class="tortilla-number stat-number">{stats.tortilla.corn}</span>
              <span class="tile-label">corn</span>
            </div>
            <div class="tortilla-stat">
              <span class="tortilla-number stat-number">{stats.tortilla.flour}</span>
              <span class="tile-label">flour</span>
            </div>
            <div class="tortilla-stat">
              <span class="tortilla-number stat-number">{stats.tortilla.both}</span>
              <span class="tile-label">both</span>
            </div>
            <div class="tortilla-stat">
              <span class="tortilla-number stat-number">
                {Math.round((stats.tortilla.handmade / stats.totalSpots) * 100)}%
              </span>
              <span class="tile-label">handmade</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <section class="census-section">
      <h2 class="section-title">When can you get a taco?</h2>
      <p class="section-sub">Spots open by hour of day — darker means more open doors</p>
      <div class="open-grid" role="img" aria-label="Heatmap of open spots by day and hour">
        <div class="grid-row grid-hours">
          <span class="grid-day"></span>
          {#each Array(24) as _, h}
            <span class="grid-hour-label">{h % 6 === 0 ? h : ''}</span>
          {/each}
        </div>
        {#each stats.openGrid as row, d}
          <div class="grid-row">
            <span class="grid-day">{DAY_LABELS[d]}</span>
            {#each row as count, h}
              <span
                class="grid-cell"
                style="background:{gridColor(count, stats.maxOpenCount)}"
                title={`${DAY_LABELS[d]} ${h}:00 — ${count} open`}
              ></span>
            {/each}
          </div>
        {/each}
      </div>
    </section>

    {#if stats.growth.length > 1}
      <section class="census-section">
        <h2 class="section-title">The map keeps growing</h2>
        <p class="section-sub">Cumulative spots since CartoTaco started counting</p>
        <div class="chart growth-chart" bind:this={growthEl}></div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .census-page {
    max-width: 920px;
    margin: 0 auto;
    padding: 84px 16px 40px;
    /* Defense in depth: never let an overflowing child pan the whole page.
       clip, not hidden — hidden would break position: sticky descendants */
    overflow-x: clip;
  }

  .census-section,
  .chart {
    min-width: 0;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--ink-1);
    margin: 0;
    text-align: center;
  }

  .back-btn,
  .share-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--line-1);
    background: var(--surface-1);
    color: var(--ink-2);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .back-btn:hover,
  .share-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .census-intro {
    text-align: center;
    font-size: 13px;
    color: var(--ink-2);
    margin: 0 0 18px;
  }

  /* Hero tiles */
  .hero-tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin-bottom: 18px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 14px 10px;
    border: 1px solid var(--line-1);
    border-radius: 12px;
    background: var(--surface-2);
    text-align: center;
  }

  .tile-number {
    font-size: 30px;
    font-weight: 800;
    color: var(--accent);
    line-height: 1.1;
  }

  .tile-name {
    font-size: 18px;
  }

  .tile-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--ink-3);
  }

  /* Sections */
  .census-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }

  .census-col {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .census-section {
    border: 1px solid var(--line-1);
    border-radius: 12px;
    background: var(--surface-2);
    padding: 14px 16px;
    margin-bottom: 14px;
  }

  .census-grid .census-section {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-1);
    margin: 0 0 2px;
  }

  .section-sub {
    font-size: 11px;
    color: var(--ink-3);
    margin: 0 0 8px;
  }

  .chart {
    width: 100%;
  }

  .protein-chart {
    height: 160px;
  }

  .heat-chart {
    height: 180px;
  }

  .growth-chart {
    height: 220px;
  }

  /* Tortilla split */
  .tortilla-row {
    display: flex;
    justify-content: space-around;
    gap: 8px;
    padding: 8px 0 4px;
  }

  .tortilla-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .tortilla-number {
    font-size: 24px;
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
  }

  /* Open-hours grid */
  .open-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .grid-row {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .grid-day {
    width: 22px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-2);
  }

  /* 24 columns must fit a 390px phone: keep the per-cell floor small
     (24 × 8px + gaps + day label ≈ 286px) so the grid never forces the
     document wider than the viewport */
  .grid-cell {
    flex: 1;
    min-width: 8px;
    height: 16px;
    border-radius: 3px;
  }

  .grid-hour-label {
    flex: 1;
    min-width: 8px;
    font-size: 9px;
    color: var(--ink-3);
    text-align: left;
  }

  @media (max-width: 720px) {
    .census-grid {
      grid-template-columns: 1fr;
    }

    .page-title {
      font-size: 1.15rem;
    }
  }
</style>

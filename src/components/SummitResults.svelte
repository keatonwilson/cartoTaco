<script>
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import { effectiveTheme } from '$lib/theme.js';

  /** @type {{ voter_token: string, est_id: number, rank: number }[]} */
  export let votes = [];

  /** @type {import('$lib/stores').ProcessedSite[]} */
  export let sites = [];

  /** Whether the session is closed (finalised results vs live preview) */
  export let locked = false;

  /** Summit title shown on the download card */
  export let title = 'Taco Summit';

  /** Show the "Download card" button */
  export let showDownload = false;

  let chartContainer;
  let chart;
  let downloading = false;

  // ─── Data computation ─────────────────────────────────────────────────────

  function prepareChartData(votes, sites) {
    const n = sites.length;
    if (n === 0 || votes.length === 0) return null;

    const voterSet = new Set(votes.map(v => v.voter_token));
    const voterCount = voterSet.size;

    // Rank distribution: distribution[estId][rank] = count
    const distribution = {};
    sites.forEach(s => {
      distribution[s.est_id] = {};
      for (let r = 1; r <= n; r++) distribution[s.est_id][r] = 0;
    });
    votes.forEach(v => {
      if (distribution[v.est_id] !== undefined) {
        distribution[v.est_id][v.rank] = (distribution[v.est_id][v.rank] || 0) + 1;
      }
    });

    // Borda scores: n points for 1st, n-1 for 2nd, … per ballot
    const bordaScores = Object.fromEntries(sites.map(s => [s.est_id, 0]));
    const byVoter = {};
    votes.forEach(v => {
      (byVoter[v.voter_token] ??= []).push(v);
    });
    Object.values(byVoter).forEach(ballot => {
      const sorted = [...ballot].sort((a, b) => a.rank - b.rank);
      sorted.forEach((v, i) => { bordaScores[v.est_id] += (n - i); });
    });

    // Sort ascending — ECharts horizontal bar renders bottom→top,
    // so lowest score first means the winner appears at the top visually.
    const sorted = [...sites].sort((a, b) => bordaScores[a.est_id] - bordaScores[b.est_id]);

    const winner = sorted[sorted.length - 1];
    const firstChoiceForWinner = distribution[winner.est_id][1];

    return { sorted, distribution, bordaScores, voterCount, winner, firstChoiceForWinner, n };
  }

  $: chartData = prepareChartData(votes, sites);

  // ─── ECharts config ───────────────────────────────────────────────────────

  /** Orange gradient: 1st choice = brand orange, last choice = near-white / near-dark */
  function rankColors(n, isDark) {
    const base = [254, 121, 93]; // #FE795D
    const end = isDark ? [55, 65, 81] : [229, 231, 235]; // #374151 / #E5E7EB
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : i / (n - 1);
      const r = Math.round(base[0] + (end[0] - base[0]) * t);
      const g = Math.round(base[1] + (end[1] - base[1]) * t);
      const b = Math.round(base[2] + (end[2] - base[2]) * t);
      return `rgb(${r},${g},${b})`;
    });
  }

  function rankLabel(rank) {
    if (rank === 1) return '1st choice';
    if (rank === 2) return '2nd choice';
    if (rank === 3) return '3rd choice';
    return `${rank}th choice`;
  }

  function buildOption(data, isDark) {
    const { sorted, distribution, n, voterCount } = data;
    const colors = rankColors(n, isDark);
    const textColor = isDark ? '#f9fafb' : '#1f2937';
    const gridColor = isDark ? '#374151' : '#e5e7eb';

    const series = Array.from({ length: n }, (_, i) => {
      const rank = i + 1;
      return {
        name: rankLabel(rank),
        type: 'bar',
        stack: 'total',
        barMaxWidth: 36,
        data: sorted.map(s => distribution[s.est_id][rank] || 0),
        itemStyle: {
          color: colors[i],
          borderRadius: i === n - 1 ? [0, 4, 4, 0] : 0,
        },
        label: {
          show: rank === 1,
          position: 'inside',
          formatter: p => p.value > 0 ? String(p.value) : '',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: params => {
          const spotName = sorted[params[0].dataIndex].name;
          const lines = params
            .filter(p => p.value > 0)
            .map(p => `${p.marker}${p.seriesName}: <b>${p.value}</b>`);
          return `<b>${spotName}</b><br/>${lines.join('<br/>')}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textColor, fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
      },
      grid: { left: 8, right: 16, top: 8, bottom: 48, containLabel: true },
      xAxis: {
        type: 'value',
        max: voterCount,
        minInterval: 1,
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: textColor, fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: sorted.map(s => s.name),
        axisLabel: {
          color: textColor,
          fontSize: 12,
          overflow: 'truncate',
          width: 130,
        },
      },
      series,
    };
  }

  // ─── Download card ────────────────────────────────────────────────────────

  async function downloadCard() {
    if (!chart || !chartData || downloading) return;
    downloading = true;

    const isDark = $effectiveTheme === 'dark';
    const bg = isDark ? '#0a0e1a' : '#ffffff';
    const textPrimary = isDark ? '#f9fafb' : '#111827';
    const textMuted = '#9ca3af';
    const accent = '#FE795D';

    // Render chart to a high-res image with a solid background
    const chartDataUrl = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: bg,
    });

    const chartImg = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = chartDataUrl;
    });

    // Card dimensions (logical pixels; canvas is 2× for retina)
    const scale = 2;
    const cardW = 600;
    const headerH = 148;
    const chartH = Math.max(180, chartData.sorted.length * 52 + 60);
    const footerH = 36;
    const totalH = headerH + chartH + footerH;

    const canvas = document.createElement('canvas');
    canvas.width = cardW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cardW, totalH);

    // Orange left accent bar
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 4, totalH);

    // ── Header ──
    const lx = 20; // left x

    // "TACO SUMMIT RESULTS"
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = accent;
    ctx.letterSpacing = '0.08em';
    ctx.fillText('TACO SUMMIT RESULTS', lx, 26);
    ctx.letterSpacing = '0';

    // Session title
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textPrimary;
    ctx.fillText(title, lx, 54);

    // "WINNER" label
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textMuted;
    ctx.letterSpacing = '0.06em';
    ctx.fillText('WINNER', lx, 80);
    ctx.letterSpacing = '0';

    // Winner name
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textPrimary;
    ctx.fillText(chartData.winner.name, lx, 104);

    // Winner sub-text
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textMuted;
    const voterWord = chartData.voterCount === 1 ? 'voter' : 'voters';
    ctx.fillText(
      `${chartData.firstChoiceForWinner} of ${chartData.voterCount} ${voterWord} ranked this first`,
      lx, 124
    );

    // Divider
    ctx.fillStyle = isDark ? '#374151' : '#e5e7eb';
    ctx.fillRect(lx, 138, cardW - lx * 2, 1);

    // ── Chart image ──
    ctx.drawImage(chartImg, 0, headerH, cardW, chartH);

    // ── Footer ──
    const fy = totalH - 12;
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textMuted;
    const ballotWord = chartData.voterCount === 1 ? 'ballot' : 'ballots';
    ctx.fillText(
      `Based on ${chartData.voterCount} ${ballotWord}  ·  cartotaco.com`,
      lx, fy
    );

    // Download
    const link = document.createElement('a');
    link.download = `taco-summit-${title.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    downloading = false;
  }

  // ─── Chart lifecycle ──────────────────────────────────────────────────────

  onMount(() => {
    function initChart() {
      if (!chartContainer || chartContainer.clientWidth === 0) {
        requestAnimationFrame(initChart);
        return;
      }
      chart = echarts.init(chartContainer);
      if (chartData) {
        chart.setOption(buildOption(chartData, $effectiveTheme === 'dark'));
      }
    }
    initChart();
    return () => { if (chart) chart.dispose(); };
  });

  // Re-render when data or theme changes
  $: if (chart && chartData) {
    chart.setOption(buildOption(chartData, $effectiveTheme === 'dark'), true);
  }

  // Chart height scales with number of spots
  $: chartHeight = Math.max(180, sites.length * 52);
</script>

{#if chartData}
  <!-- Winner callout -->
  <div class="winner-card" class:locked>
    <span class="trophy" aria-hidden="true">{locked ? '🌮' : '📊'}</span>
    <div class="winner-body">
      <div class="winner-label">{locked ? 'Summit Winner!' : 'Current Leader'}</div>
      <div class="winner-name">{chartData.winner.name}</div>
      <div class="winner-sub">
        {chartData.firstChoiceForWinner} of {chartData.voterCount}
        {chartData.voterCount === 1 ? 'voter' : 'voters'} ranked this first
      </div>
    </div>
  </div>

  <!-- Chart -->
  <div class="chart-section">
    <div class="chart-title">How the group ranked it</div>
    <div
      bind:this={chartContainer}
      class="chart-container"
      style="height: {chartHeight}px;"
    ></div>
  </div>

  <div class="results-footer">
    <span class="ballot-count">
      Based on {chartData.voterCount} {chartData.voterCount === 1 ? 'ballot' : 'ballots'}
      {#if !locked}
        &middot; <span class="live-hint">updating live</span>
      {/if}
    </span>

    {#if showDownload && locked}
      <button class="download-btn" on:click={downloadCard} disabled={downloading}>
        {downloading ? 'Saving…' : '↓ Download card'}
      </button>
    {/if}
  </div>
{:else}
  <div class="empty-state">No votes yet — be the first to rank!</div>
{/if}

<style>
  .winner-card {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
    border-left: 4px solid #FE795D;
    background: rgba(254, 121, 93, 0.07);
    border-radius: 0 0.5rem 0.5rem 0;
    margin-bottom: 1.25rem;
  }

  .winner-card.locked {
    background: rgba(254, 121, 93, 0.13);
  }

  :global(.dark) .winner-card {
    background: rgba(254, 121, 93, 0.1);
  }

  :global(.dark) .winner-card.locked {
    background: rgba(254, 121, 93, 0.18);
  }

  .trophy {
    font-size: 1.75rem;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .winner-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .winner-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #FE795D;
  }

  .winner-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: #111827;
    line-height: 1.2;
  }

  :global(.dark) .winner-name {
    color: #f9fafb;
  }

  .winner-sub {
    font-size: 0.8rem;
    color: #6b7280;
  }

  :global(.dark) .winner-sub {
    color: #9ca3af;
  }

  .chart-section {
    margin-bottom: 0.5rem;
  }

  .chart-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  :global(.dark) .chart-title {
    color: #9ca3af;
  }

  .chart-container {
    width: 100%;
  }

  .results-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .ballot-count {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .download-btn {
    padding: 0.4rem 0.875rem;
    font-size: 0.78rem;
    font-weight: 600;
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .download-btn:hover:not(:disabled) {
    border-color: #FE795D;
    color: #FE795D;
    background: rgba(254, 121, 93, 0.06);
  }

  .download-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  :global(.dark) .download-btn {
    border-color: #4b5563;
    color: #d1d5db;
  }

  :global(.dark) .download-btn:hover:not(:disabled) {
    border-color: #FE795D;
    color: #FE795D;
  }

  .live-hint {
    color: #FE795D;
    font-weight: 500;
  }

  .empty-state {
    padding: 1.5rem;
    text-align: center;
    color: #9ca3af;
    font-style: italic;
    font-size: 0.9rem;
  }
</style>

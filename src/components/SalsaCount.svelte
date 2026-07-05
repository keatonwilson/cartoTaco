<script>
    import { onMount } from "svelte";
    import * as echarts from "echarts";
    import { effectiveTheme } from '$lib/theme';
    import { accent, chartInk, tooltipStyle } from '$lib/chartTheme';

    export let value;
    export let meanValue;
    export let maxValue;
    /** 0–100 share of spots this one has more salsas than; null keeps the generic line */
    export let percentile = null;

    let container;
    let chart;
    let resizeObserver;

    $: isDark = $effectiveTheme === 'dark';

    function buildOption() {
      const ink = chartInk(isDark);
      const brand = accent(isDark);

      return {
        backgroundColor: 'transparent',
        grid: { left: 2, right: 8, top: 6, bottom: 6 },
        tooltip: {
          ...tooltipStyle(isDark),
          trigger: 'item',
          confine: true,
          formatter: () =>
            `Salsas: <b>${value}</b><br/>City average: <b>${Math.round(meanValue)}</b><br/>City max: <b>${maxValue}</b>`
        },
        xAxis: {
          type: 'value',
          min: 0,
          max: maxValue,
          show: false
        },
        yAxis: {
          type: 'category',
          data: ['Salsa Count'],
          show: false
        },
        series: [
          {
            type: 'bar',
            data: [value],
            barWidth: 14,
            itemStyle: {
              color: brand,
              borderRadius: [0, 4, 4, 0]
            },
            // Gray track spanning the full axis (city max)
            showBackground: true,
            backgroundStyle: {
              color: ink.grid,
              borderRadius: 4
            },
            // City-average tick — the stats row below carries its label
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: ink.label, width: 2, type: 'solid' },
              label: { show: false },
              data: [{ xAxis: meanValue }]
            }
          }
        ]
      };
    }

    onMount(() => {
      if (!container) return;

      chart = echarts.init(container);
      chart.setOption(buildOption());

      // Card layouts mount this at 0×0 — resize when dimensions appear
      resizeObserver = new ResizeObserver(() => {
        if (chart) chart.resize();
      });
      resizeObserver.observe(container);

      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        if (chart) {
          chart.dispose();
          chart = null;
        }
      };
    });

    // Rebuild when values or theme change
    $: if (chart && (isDark === true || isDark === false) && value !== undefined) {
      chart.setOption(buildOption(), { notMerge: true });
    }
  </script>

  <div class="salsa-wrapper">
    <div class="chart-container">
      <div class="chart-label">Salsa Count</div>
      <div class="bar-chart" bind:this={container}></div>
    </div>
    <div class="salsa-stats">
      <span class="stat-item"><strong>{value}</strong> salsas</span>
      <span class="stat-divider">•</span>
      <span class="stat-item">Avg: <strong>{Math.round(meanValue)}</strong></span>
      <span class="stat-divider">•</span>
      <span class="stat-item">Max: <strong>{maxValue}</strong></span>
    </div>
    <div class="salsa-explanation">
      {#if percentile !== null}
        More salsa variety than {percentile}% of Tucson spots
      {:else}
        Number of different salsas available at this location
      {/if}
    </div>
  </div>

  <style>
    .salsa-wrapper {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .chart-container {
      display: flex;
      align-items: center;
      margin: 3px;
      overflow: hidden;
      width: 100%;
      max-height: 70px;
    }

    .chart-label {
      margin-right: 8px;
      font-weight: bold;
      font-size: 12px;
      width: 20%;
    }

    :global(.dark) .chart-label {
      color: #f9fafb;
    }

    .bar-chart {
      flex: 1;
      height: 44px;
      min-width: 0;
    }

    .salsa-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      color: #555;
      margin-top: 2px;
    }

    :global(.dark) .salsa-stats {
      color: #d1d5db;
    }

    .stat-item strong {
      color: var(--accent);
      font-weight: 700;
    }

    .stat-divider {
      color: #ccc;
    }

    :global(.dark) .stat-divider {
      color: #6b7280;
    }

    .salsa-explanation {
      font-size: 10px;
      color: #666;
      text-align: center;
      font-style: italic;
      margin-top: 2px;
      padding: 0 8px;
    }

    :global(.dark) .salsa-explanation {
      color: #9ca3af;
    }
  </style>

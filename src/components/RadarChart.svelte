<script>
  import { onMount } from "svelte";
  import * as echarts from "echarts";
  import { effectiveTheme } from '$lib/theme';
  import { seriesColors, withAlpha, chartInk, tooltipStyle, baseTextStyle, CHART_FONT } from '$lib/chartTheme';

  /** Axis labels, shared by every series */
  export let labels;
  /** Single-series values (legacy API) — ignored when seriesList is given */
  export let data = null;
  /**
   * Multi-series overlay: [{ name, values, dashed? }] — series wear the
   * categorical palette in fixed slot order and get a legend.
   */
  export let seriesList = null;
  /**
   * Fixed axis max so radar shapes are comparable across spots/cards.
   * Values are percentages, so 100 is the honest default.
   */
  export let max = 100;

  let container;
  let chart;
  let resizeObserver;

  $: isDark = $effectiveTheme === 'dark';
  $: resolvedSeries = seriesList || (data ? [{ name: 'Distribution', values: data }] : []);
  $: multiSeries = resolvedSeries.length > 1;

  function buildOption() {
    const ink = chartInk(isDark);
    const colors = seriesColors(isDark, Math.max(resolvedSeries.length, 1));

    return {
      backgroundColor: 'transparent',
      legend: multiSeries
        ? {
            bottom: 0,
            itemWidth: 10,
            itemHeight: 10,
            icon: 'circle',
            textStyle: { ...baseTextStyle(isDark) }
          }
        : undefined,
      tooltip: {
        ...tooltipStyle(isDark),
        trigger: 'item',
        confine: true,
        formatter: (params) => {
          const series = resolvedSeries[params.dataIndex ?? 0] || resolvedSeries[0];
          const header = multiSeries ? `<b>${params.name}</b><br/>` : '';
          return (
            header +
            (labels || [])
              .map((label, i) => {
                const value = Math.round(params.value?.[i] ?? series?.values?.[i] ?? 0);
                return `${label}: <b>${value}%</b>`;
              })
              .join('<br/>')
          );
        }
      },
      radar: {
        indicator: (labels || []).map((name) => ({ name, max, min: 0 })),
        // Fill the container — the wrap/nameGap settings below keep axis
        // labels inside even at this radius (ECharts doesn't auto-fit them)
        radius: multiSeries ? '58%' : '66%',
        center: ['50%', multiSeries ? '48%' : '52%'],
        nameGap: 8,
        axisName: {
          color: ink.strong,
          fontFamily: CHART_FONT,
          fontSize: 10,
          fontWeight: 600,
          // Wrap long labels instead of letting them clip at the container edge
          overflow: 'break',
          width: 58
        },
        axisLine: { lineStyle: { color: ink.grid } },
        splitLine: { lineStyle: { color: ink.grid } },
        splitArea: { show: false }
      },
      series: [
        {
          type: 'radar',
          data: resolvedSeries.map((s, i) => ({
            value: s.values || [],
            name: s.name,
            symbol: 'circle',
            symbolSize: multiSeries ? 4 : 6,
            lineStyle: {
              width: 2,
              color: colors[i],
              type: s.dashed ? 'dashed' : 'solid'
            },
            itemStyle: { color: colors[i], borderColor: '#fff', borderWidth: 1 },
            areaStyle: { color: withAlpha(colors[i], s.dashed ? 0.06 : multiSeries ? 0.12 : 0.18) }
          }))
        }
      ]
    };
  }

  onMount(() => {
    if (!container) return;

    chart = echarts.init(container);
    chart.setOption(buildOption());

    // Popups/collapsibles can mount this at 0×0 — resize when dimensions appear
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

  // Rebuild when data, labels, or theme change
  $: if (chart && labels && resolvedSeries.length > 0 && (isDark === true || isDark === false)) {
    chart.setOption(buildOption(), { notMerge: true });
  }
</script>

<div class="chart-wrapper" bind:this={container}></div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>

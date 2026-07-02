<script>
  import { onMount } from "svelte";
  import * as echarts from "echarts";
  import { effectiveTheme } from '$lib/theme';
  import { accent, withAlpha, chartInk, tooltipStyle, CHART_FONT } from '$lib/chartTheme';

  export let labels;
  export let data;

  let container;
  let chart;
  let resizeObserver;

  // Calculate dynamic max value based on data
  $: maxDataValue = data && data.length > 0 ? Math.max(...data) : 100;
  $: dynamicMax = maxDataValue < 50 ? 50 : 75;

  $: isDark = $effectiveTheme === 'dark';

  function buildOption() {
    const ink = chartInk(isDark);
    const brand = accent(isDark);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle(isDark),
        trigger: 'item',
        confine: true,
        formatter: () => {
          return (labels || [])
            .map((label, i) => {
              const value = Math.round(data?.[i] ?? 0);
              return `${label}: <b>${value}%</b>`;
            })
            .join('<br/>');
        }
      },
      radar: {
        indicator: (labels || []).map((name) => ({ name, max: dynamicMax, min: 0 })),
        // Modest radius leaves room for axis labels — ECharts doesn't auto-fit
        // them into the container the way Chart.js did
        radius: '58%',
        center: ['50%', '52%'],
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
          data: [{ value: data || [], name: 'Distribution' }],
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: brand },
          itemStyle: { color: brand, borderColor: '#fff', borderWidth: 1 },
          areaStyle: { color: withAlpha(brand, 0.18) },
          emphasis: { itemStyle: { symbolSize: 8 } }
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
  $: if (chart && labels && data && (isDark === true || isDark === false)) {
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

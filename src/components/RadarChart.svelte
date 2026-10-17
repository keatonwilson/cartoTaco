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
  /** Axis label size in px; the wrap width scales with it */
  export let labelSize = 10;
  /** Single series only: print each axis's value under its name ("Taco / 55%") */
  export let showValues = false;

  let container;
  let chart;
  let resizeObserver;

  $: isDark = $effectiveTheme === 'dark';
  $: resolvedSeries = seriesList || (data ? [{ name: 'Distribution', values: data }] : []);
  $: multiSeries = resolvedSeries.length > 1;

  // With values printed under each label, the labels are two lines tall and
  // wider, so a percentage radius clips them in narrow boxes. Size the radar
  // from the box instead: as big as fits with room left for the labels. The
  // vertical margin covers a full two-line label plus nameGap, because with an
  // even number of axes one points straight down (and one straight up).
  function fittedRadius() {
    const w = container?.clientWidth || 300;
    const h = container?.clientHeight || 300;
    const labelW = labelSize * 5.8;
    const labelH = labelSize * 2.7 + 2;
    return Math.max(60, Math.min(h / 2 - labelH - 8 - 6, w / 2 - labelW - 10));
  }

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
        radius: multiSeries ? '58%' : showValues ? fittedRadius() : '66%',
        center: ['50%', multiSeries ? '48%' : showValues ? '50%' : '52%'],
        nameGap: 8,
        axisName: {
          color: ink.strong,
          fontFamily: CHART_FONT,
          fontSize: labelSize,
          fontWeight: 600,
          // Wrap long labels instead of letting them clip at the container edge
          overflow: 'break',
          width: Math.round(labelSize * 5.8),
          ...(showValues && !multiSeries
            ? {
                formatter: (name) => {
                  const i = (labels || []).indexOf(name);
                  const v = Math.round(resolvedSeries[0]?.values?.[i] ?? 0);
                  return `{name|${name}}\n{value|${v}%}`;
                },
                rich: {
                  name: { fontSize: labelSize, fontWeight: 600, color: ink.strong, fontFamily: CHART_FONT },
                  value: {
                    fontSize: labelSize + 1,
                    fontWeight: 700,
                    color: colors[0],
                    fontFamily: CHART_FONT,
                    padding: [2, 0, 0, 0]
                  }
                }
              }
            : {})
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
      if (!chart) return;
      chart.resize();
      if (showValues) chart.setOption(buildOption(), { notMerge: true });
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
  $: if (chart && labels && resolvedSeries.length > 0 && (isDark === true || isDark === false) && labelSize && showValues !== undefined) {
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

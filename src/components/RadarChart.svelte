<script>
  import { onMount } from "svelte";
  import { Chart } from "chart.js/auto";
  import { effectiveTheme } from '$lib/theme';

  export let labels;
  export let data;

  let canvas;
  let chartInstance;

  // Calculate dynamic max value based on data
  $: maxDataValue = data && data.length > 0 ? Math.max(...data) : 100;
  $: dynamicMax = maxDataValue < 50 ? 50 : 75;

  // Theme-reactive colors
  $: gridColor = $effectiveTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  $: labelColor = $effectiveTheme === 'dark' ? '#f9fafb' : '#333';

  onMount(() => {
    if (canvas) {
      chartInstance = new Chart(canvas, {
        type: "radar",
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Menu Distribution',
              data: data,
              fill: true,
              backgroundColor: "rgba(254, 121, 93, 0.2)", // Orange theme
              borderColor: "rgb(254, 121, 93)",
              pointBackgroundColor: "rgb(254, 121, 93)",
              pointBorderColor: "#fff",
              pointHoverBackgroundColor: "#fff",
              pointHoverBorderColor: "rgb(254, 121, 93)",
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          elements: {
            line: {
              borderWidth: 2,
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: {
                size: 12,
                weight: 'bold'
              },
              bodyFont: {
                size: 11
              },
              padding: 8,
              displayColors: false,
              callbacks: {
                title: function(context) {
                  return context[0].label;
                },
                label: function(context) {
                  const value = context.parsed.r;
                  const percentage = Math.round(value);
                  return `${percentage}% of menu`;
                }
              }
            }
          },
          layout: {
            padding: 2
          },
          scales: {
            r: {
              angleLines: {
                display: true,
                color: gridColor
              },
              grid: {
                color: gridColor
              },
              pointLabels: {
                display: true,
                font: {
                  size: 10,
                  weight: '600'
                },
                color: labelColor
              },
              ticks: {
                display: false,
              },
              min: 0,
              max: dynamicMax,
            },
          },
        },
      });
    }

    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
  });

  // Update chart when data or max changes
  $: if (chartInstance && labels && data) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.options.scales.r.max = dynamicMax;
    chartInstance.update();
  }

  // Update chart when theme changes
  $: if (chartInstance && $effectiveTheme) {
    chartInstance.options.scales.r.angleLines.color = gridColor;
    chartInstance.options.scales.r.grid.color = gridColor;
    chartInstance.options.scales.r.pointLabels.color = labelColor;
    chartInstance.update();
  }
</script>

{#if labels && labels.length >= 3}
  <div class="chart-wrapper">
    <canvas bind:this={canvas}></canvas>
  </div>
{:else if labels && labels.length > 0}
  <div class="insufficient-data">
    <p>{labels.join(', ')}</p>
    <span>Not enough variety to display chart</span>
  </div>
{:else}
  <div class="insufficient-data">
    <span>No menu data available</span>
  </div>
{/if}

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .insufficient-data {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #9ca3af;
    text-align: center;
    padding: 8px;
  }

  .insufficient-data p {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    margin: 0;
  }

  .insufficient-data span {
    font-size: 11px;
    font-style: italic;
  }
</style>

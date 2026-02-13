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
          maintainAspectRatio: true,
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
                size: 14,
                weight: 'bold'
              },
              bodyFont: {
                size: 13
              },
              padding: 12,
              displayColors: false,
              callbacks: {
                title: function(context) {
                  return context[0].label;
                },
                label: function(context) {
                  const value = context.parsed.r;
                  const percentage = Math.round(value);
                  return [
                    `Represents ${percentage}% of menu`,
                    '',
                    'This shows how prominently',
                    'this item features on the menu'
                  ];
                }
              }
            }
          },
          layout: {
            padding: 5
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
                  size: 12,
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

<canvas bind:this={canvas}></canvas>


<style>
  /* canvas {
    max-width: 250px;
    height: auto;
  } */
</style>

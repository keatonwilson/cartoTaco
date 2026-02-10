<script>
  import { onMount } from "svelte";
  import { Chart } from "chart.js/auto";

  export let labels;
  export let data;

  let canvas;
  let chartInstance;

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
                color: 'rgba(0, 0, 0, 0.1)'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              pointLabels: {
                display: true,
                font: {
                  size: 12,
                  weight: '600'
                },
                color: '#333'
              },
              ticks: {
                display: false,
              },
              suggestedMin: 0,
              suggestedMax: 100,
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
</script>

<canvas bind:this={canvas}></canvas>


<style>
  /* canvas {
    max-width: 250px;
    height: auto;
  } */
</style>

<script>
    import { onMount } from "svelte";
    import { Chart, registerables } from "chart.js/auto";
    import ChartAnnotation from "chartjs-plugin-annotation";
    Chart.register(ChartAnnotation);
  
    export let value;
    export let meanValue;
    export let maxValue;
  
    let canvas;
    let chartInstance;
  
    onMount(() => {
      if (canvas) {
  
        chartInstance = new Chart(canvas, {
          type: "bar",
          data: {
            labels: ["Salsa Count"],
            datasets: [
              {
                data: [maxValue],
                backgroundColor: "rgba(211, 211, 211, 0.5)", // Gray background
                barPercentage: 0.2, // Adjust bar height
                categoryPercentage: 0.8, // Adjust bar height
                order: 2,
                label: "Max Value",
              },
              {
                data: [value],
                backgroundColor: "rgb(204, 85, 0)",
                barPercentage: 0.2, // Adjust bar height
                categoryPercentage: 0.8, // Adjust bar height
                order: 1,
                label: "Value",
              },
            ],
          },
          options: {
            indexAxis: "y",
            scales: {
              x: {
                display: false,
                max: maxValue,
                stacked: true,
              },
              y: {
                display: false,
                stacked: true,
              },
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                mode: 'nearest',
                intersect: false, 
                position: 'nearest',
                enabled: true,
                callbacks: {
                  label: function (context) {
                    let label = context.dataset.label || "";
                    if (label) {
                      label += ": ";
                    }
                    if (context.parsed.x !== null) {
                      label += context.parsed.x;
                    }
                    return label;
                  },
                },
              },
              annotation: {
                annotations: {
                  line1: {
                    type: "line",
                    xMin: meanValue,
                    xMax: meanValue,
                    borderColor: "lightgrey",
                    borderWidth: 3,
                    label: {
                      enabled: true,
                      content: "Mean",
                      position: "center",
                      backgroundColor: "rgba(0,0,0,0.8)",
                      color: "white",
                      font: {
                        size: 10,
                      },
                    },
                  },
                },
              },
            },
            elements: {
              bar: {
                borderRadius: 10, // Set this value to control the roundness of the corners
              },
            },
          },
        });
  
        return () => {
          if (chartInstance) {
            chartInstance.destroy();
          }
        };
      }
    });
  </script>
  
  <div class="salsa-wrapper">
    <div class="chart-container">
      <div class="chart-label">Salsa Count</div>
      <canvas id="salsaBarChart" bind:this={canvas}></canvas>
    </div>
    <div class="salsa-stats">
      <span class="stat-item"><strong>{value}</strong> salsas</span>
      <span class="stat-divider">•</span>
      <span class="stat-item">Avg: <strong>{Math.round(meanValue)}</strong></span>
      <span class="stat-divider">•</span>
      <span class="stat-item">Max: <strong>{maxValue}</strong></span>
    </div>
    <div class="salsa-explanation">
      Number of different salsas available at this location
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

    #salsaBarChart {
        width: auto;
        height: auto;
    }

    .salsa-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: #555;
      margin-top: 2px;
    }

    :global(.dark) .salsa-stats {
      color: #d1d5db;
    }

    .stat-item strong {
      color: #FE795D;
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
  
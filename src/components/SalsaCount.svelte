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
                barPercentage: 0.4, // Adjust bar height
                categoryPercentage: 0.8, // Adjust bar height
                order: 2,
                label: "Max Value",
              },
              {
                data: [value],
                backgroundColor: "rgb(204, 85, 0)",
                barPercentage: 0.4, // Adjust bar height
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
  
  <div class="chart-container">
    <div class="chart-label">Salsa Count</div>
    <canvas id="salsaBarChart" bind:this={canvas}></canvas>
  </div>
  
  <style>
    .chart-container {
      display: flex;
      align-items: center;
      height: 100px; /* Increase the container height */
      margin: 5px;
      overflow: hidden;
      width: 100%;
    }
    .chart-label {
      margin-right: 10px;
      font-weight: bold;
      width: 20%;
    }

    #salsaBarChart {
        width: 80%;
        height: auto;
    }
  </style>
  
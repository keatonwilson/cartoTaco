<script>
  import { onMount } from "svelte";
  import { Chart } from "chart.js/auto";

  export let labels;
  export let data;

  let canvas;
  let chartInstance;
  // export let topFiveItems;
  // console.log(topFiveItems);

  onMount(() => {
    if (canvas) {
      chartInstance = new Chart(canvas, {
        type: "radar",
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              fill: true,
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              borderColor: "rgb(75, 192, 192)",
              pointBackgroundColor: "rgb(75, 192, 192)",
              pointBorderColor: "#fff",
              pointHoverBackgroundColor: "#fff",
              pointHoverBorderColor: "rgb(75, 192, 192)",
            },
          ],
        },
        options: {
          elements: {
            line: {
              borderWidth: 1,
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
          layout: {
            padding: 5
          },
          scales: {
            r: {
              angleLines: {
                display: true,
              },
              pointLabels: {
                display: true,
                font: {
                  size: 12 // Adjust this value to change the font size
                },
              },
              ticks: {
                display: false,
              },
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

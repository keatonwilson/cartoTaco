<script>
  import { onMount } from "svelte";
  import * as echarts from "echarts";
  import { redirect } from "@sveltejs/kit";

  export let spiceValue = 0;

  let gaugeContainer;
  let chart;

  onMount(() => {
    function initializeChart() {
      // Check if gaugeContainer is null
      if (!gaugeContainer) {
        requestAnimationFrame(initializeChart);
        return;
      }

      // Check if gaugeContainer has dimensions
      if (gaugeContainer.clientWidth === 0 || gaugeContainer.clientHeight === 0) {
        requestAnimationFrame(initializeChart);
        return;
      }

      chart = echarts.init(gaugeContainer);

      const option = {
        series: [
          {
            type: "gauge",
            min: 0,
            max: 10,
            splitNumber: 5, // Fewer ticks
            center: ["50%", "50%"], // Center the gauge vertically
            radius: "65%", // Adjust the radius to reduce whitespace
            axisLine: {
              lineStyle: {
                width: 4, // Thinner gauge line
                color: [
                  [0.3, "#FFD700"],
                  [0.7, "#FF6E76"],
                  [1, "#CC5500"],
                ],
              },
            },
            pointer: {
              width: 2, // Thinner pointer
              length: '50%',
              itemStyle: {
                color: "auto",
              },
            },
            axisTick: {
              length: 5, // Shorter ticks
              lineStyle: {
                color: "auto",
              },
            },
            splitLine: {
              length: 10, // Shorter split lines
              lineStyle: {
                color: "auto",
              },
            },
            axisLabel: {
              show: false,
            },
            detail: {
              formatter: "{value}",
              fontSize: 25, // Larger font size for the value
              offsetCenter: [0, "60%"], // Position the value inside the gauge
            },
            data: [{ value: spiceValue }],
          },
        ],
      };

      chart.setOption(option);

      return () => {
        if (chart) {
          chart.dispose();
        }
      };
    }

    // Ensure chart initializes when DOM is ready
    initializeChart();
  });

  $: if (chart) {
    chart.setOption({
      series: [
        {
          data: [{ value: spiceValue }],
        },
      ],
    });
  }
</script>

<div bind:this={gaugeContainer} style="width: 100%; height: 150px;"></div>

<style>
  div {
    max-width: 150px;
    max-height: 150px;
  }
</style>

<script>
  import { onMount } from "svelte";
  import * as echarts from "echarts";
  import { redirect } from "@sveltejs/kit";

  export let spiceValue = 0;

  let gaugeContainer;
  let chart;

  // Helper function to get spice level description
  function getSpiceDescription(value) {
    if (value === 0) return 'No Heat';
    if (value <= 2) return 'Mild';
    if (value <= 4) return 'Medium';
    if (value <= 6) return 'Medium-Hot';
    if (value <= 8) return 'Hot';
    return 'Very Hot';
  }

  $: spiceDescription = getSpiceDescription(spiceValue);

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
            radius: "85%",
            axisLine: {
              lineStyle: {
                width: 3,
                color: [
                  [0.3, "#FFD700"],
                  [0.7, "#FF6E76"],
                  [1, "#CC5500"],
                ],
              },
            },
            pointer: {
              width: 2,
              length: '55%',
              itemStyle: {
                color: "auto",
              },
            },
            axisTick: {
              show: false,
            },
            splitLine: {
              length: 4,
              lineStyle: {
                width: 1,
                color: "auto",
              },
            },
            axisLabel: {
              show: false,
            },
            detail: {
              formatter: "{value}",
              fontSize: 12,
              offsetCenter: [0, "65%"],
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

<div class="gauge-wrapper">
  <div bind:this={gaugeContainer} class="gauge-container"></div>
  <div class="spice-description">{spiceDescription}</div>
  <div class="spice-explanation">Overall heat level across all salsas</div>
</div>

<style>
  .gauge-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .gauge-container {
    width: 100%;
    height: 120px;
    max-width: 120px;
    max-height: 120px;
  }

  .spice-description {
    font-size: 13px;
    font-weight: 700;
    color: #333;
    margin-top: -8px;
    margin-bottom: 2px;
  }

  :global(.dark) .spice-description {
    color: #f9fafb;
  }

  .spice-explanation {
    font-size: 10px;
    color: #666;
    text-align: center;
    font-style: italic;
    max-width: 130px;
    line-height: 1.3;
  }

  :global(.dark) .spice-explanation {
    color: #9ca3af;
  }
</style>

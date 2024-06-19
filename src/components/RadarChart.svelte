<script>
    import { onMount, onDestroy } from 'svelte';
    import { Chart } from 'chart.js/auto';
    import { activePopup } from '$lib/stores';
    import { get } from 'svelte/store';
  
    let canvas;
    let chartInstance;

    onMount(() => {
    if (canvas) {
      chartInstance = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Running', 'Swimming', 'Eating', 'Cycling', 'Hiking'],
        datasets: [{
          label: 'Activity Level',
          data: [20, 10, 4, 2, 7],
          fill: true,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgb(75, 192, 192)',
          pointBackgroundColor: 'rgb(75, 192, 192)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(75, 192, 192)'
        }]
      },
      options: {
        elements: {
          line: {
            borderWidth: 3
          }
        }
      }
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
    canvas {
      max-width: 100%;
      height: auto;
    }
  </style>
  
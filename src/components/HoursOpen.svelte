<script>
    export let hours = [
      { day: 'M', open: '8', close: '8', closed: false },
      { day: 'T', open: '8', close: '8', closed: false },
      { day: 'W', open: '8', close: '8', closed: false },
      { day: 'T', open: '8', close: '8', closed: false },
      { day: 'F', open: '8', close: '8', closed: false },
      { day: 'S', open: '8', close: '8', closed: false },
      { day: 'S', open: '', close: '', closed: true }
    ];
  </script>
  
  <style>
    .container {
      display: flex;
      align-items: center;
    }
    .days {
      display: flex;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 20px; /* Adjust width as needed */
      margin: 0 5px;
      text-align: center;
      position: relative;
    }
    .closed .day-letter {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      text-decoration: line-through;
    }
    .open-now {
      font-weight: bold;
      margin-left: auto; /* Push "Open Now" to the right */
    }
  </style>
  
  <div class="container">
    <div class="days">
      {#each hours as {day, open, close, closed}, i}
        <div class="day {closed ? 'closed' : ''}">
          <div>{closed ? '' : open}</div>
          <div class="day-letter">{day}</div>
          <div>{closed ? '' : close}</div>
        </div>
      {/each}
    </div>
    <div class="open-now">Open Now</div>
  </div>
  
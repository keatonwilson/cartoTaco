<script>
  import { convertHoursData } from "$lib/dataWrangling";
  export let startHours;
  export let endHours;

  const convertedHours = convertHoursData(startHours, endHours);

  // Determine the current day and time
  let currentDay = new Date().getDay(); // Sunday - Saturday : 0 - 6
  let currentTime = new Date().getHours(); // Current hour in 24-hour format

  // Function to check if the business is open
  function isOpen(currentDay, currentTime) {
    let todayHours = convertedHours.find(
      ({ day }) => dayToNumber(day) === currentDay
    );
    if (!todayHours || todayHours.closed) {
      return false;
    }
    return (
      currentTime >= parseInt(todayHours.open) &&
      currentTime < parseInt(todayHours.close)
    );
  }

  // Mapping day letter to number
  function dayToNumber(day) {
    const dayMap = {
      S: 0, // Assuming first 'S' is Sunday
      M: 1,
      T: 2, // Assuming first 'T' is Tuesday
      W: 3,
      T: 4, // Assuming second 'T' is Thursday
      F: 5,
      S: 6, // Assuming second 'S' is Saturday
    };
    return dayMap[day];
  }

  // Determine if the business is open now
  let openNow = isOpen(currentDay, currentTime);
</script>
<style>
  .container {
    display: flex;
    align-items: center;
    border: 1px solid lightgray;
    border-radius: 8px;
    padding: 10px;
    margin: 0px;
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
  .day.closed .day-letter {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    text-decoration: line-through;
  }
  .day.current {
    font-weight: bold;
  }
  .open-now, .closed-now {
    font-weight: bold;
    margin-left: auto; /* Push "Open Now" to the right */
    animation: flash-shadow 1s infinite;
    text-align: right;
  }
  .open-now {
    color: green;
  }
  .closed-now {
    color: red;
  }
  @keyframes flash-shadow {
    0% {
      text-shadow: 0 0 5px currentColor;
    }
    50% {
      text-shadow: 0 0 8px currentColor;
    }
    100% {
      text-shadow: 0 0 5px currentColor;
    }
  }
  </style>
  
  <div class="container">
    <div class="days">
      {#each convertedHours as {day, open, close, closed}, i}
        <div class="day {closed ? 'closed' : ''} {dayToNumber(day) === currentDay ? 'current' : ''}">
          <div>{closed ? '' : open}</div>
          <div class="day-letter">{day}</div>
          <div>{closed ? '' : close}</div>
        </div>
      {/each}
    </div>
    <div class="{openNow ? 'open-now' : 'closed-now'}">
      {openNow ? 'Open Now' : 'Closed Now'}
    </div>
  </div>
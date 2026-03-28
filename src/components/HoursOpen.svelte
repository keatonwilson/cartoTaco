<script>
  import { convertHoursData } from "$lib/dataWrangling";
  export let startHours;
  export let endHours;

  // Reactive — re-runs whenever props change so the display updates on site switch
  $: convertedHours = convertHoursData(startHours, endHours);

  // Current day for the "today" highlight in the hours grid (stable for the session)
  let currentDay = new Date().getDay(); // 0 = Sunday … 6 = Saturday

  function dayToNumber(day) {
    const dayMap = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
    return dayMap[day];
  }

  /**
   * Returns true if the establishment is open right now.
   *
   * Works directly from the raw startHours/endHours prop arrays so it has
   * full minute precision (convertedHours truncates to hour-only for display).
   * Mirrors the isOpenNow() logic in stores.js used by the Open Now filter.
   */
  function isOpen(startHours, endHours) {
    const startObj = Object.fromEntries(startHours);
    const endObj   = Object.fromEntries(endHours);
    const now      = new Date();
    const days     = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayKey = days[now.getDay()];

    const startStr = startObj[`${todayKey}_start`];
    const endStr   = endObj[`${todayKey}_end`];

    if (!startStr || !endStr || endStr === 'NA') return false;

    const parseTime = (s) => {
      const [time, period] = s.trim().split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period) {
        if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period.toUpperCase() === 'AM' && h === 12) h = 0;
      }
      return h * 60 + (m || 0);
    };

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes   = parseTime(startStr);
    const endMinutes     = parseTime(endStr);

    if (isNaN(startMinutes) || isNaN(endMinutes)) return false;

    // Handle overnight hours (e.g. open until 1:00 AM next day)
    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Reactive — re-evaluates whenever startHours or endHours props change
  $: openNow = isOpen(startHours, endHours);
</script>


<style>
  .container {
    display: flex;
    align-items: center;
    border: 1px solid lightgray;
    border-radius: 6px;
    padding: 6px 8px;
    margin: 0px;
    background: #f9fafb;
    color: #111827;
    font-size: 12px;
  }

  :global(.dark) .container {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
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

<div>
  <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Hours</h2>
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
</div>


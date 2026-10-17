<script>
  // Week Rhythm strip — 7 day pills with mini open-span bars on a shared 24h
  // scale, plus a calm status dot with a Tucson-time label ("Open til 10 PM",
  // "Opens at 8 AM"). Days and "today" are Tucson's, whatever the browser's zone.
  import { getOpenStatus, parseTime, tucsonNow, minuteClock } from '$lib/hours';

  export let startHours;
  export let endHours;
  /** Hide the "Hours" heading when the surrounding section already labels it */
  export let showTitle = true;

  const DAYS = [
    { key: 'mon', label: 'Mo', dow: 1 },
    { key: 'tue', label: 'Tu', dow: 2 },
    { key: 'wed', label: 'We', dow: 3 },
    { key: 'thu', label: 'Th', dow: 4 },
    { key: 'fri', label: 'Fr', dow: 5 },
    { key: 'sat', label: 'Sa', dow: 6 },
    { key: 'sun', label: 'Su', dow: 0 }
  ];

  // Tucson's day for the "today" ring; follows the clock past midnight
  $: currentDow = tucsonNow($minuteClock).dow;

  // Reactive — re-runs whenever props change so the display updates on site switch
  $: dayData = (() => {
    const startObj = Object.fromEntries(startHours || []);
    const endObj = Object.fromEntries(endHours || []);

    return DAYS.map(({ key, label, dow }) => {
      const startStr = startObj[`${key}_start`];
      const endStr = endObj[`${key}_end`];
      const start = parseTime(startStr);
      const end = parseTime(endStr);
      const closed = start === null || end === null;

      // Open span segments as % of the 24h track; overnight hours wrap into two
      let segments = [];
      if (!closed) {
        if (end > start) {
          segments = [{ top: (start / 1440) * 100, height: ((end - start) / 1440) * 100 }];
        } else {
          segments = [
            { top: (start / 1440) * 100, height: ((1440 - start) / 1440) * 100 },
            { top: 0, height: (end / 1440) * 100 }
          ];
        }
      }

      return {
        label,
        closed,
        segments,
        today: dow === currentDow,
        times: closed ? 'Closed' : `${startStr} – ${endStr}`
      };
    });
  })();

  // Tooltip state: hover/focus shows transiently, tap pins (touch devices)
  let hoverDay = null;
  let pinnedDay = null;
  $: activeDay = hoverDay !== null ? hoverDay : pinnedDay;

  function togglePin(i) {
    pinnedDay = pinnedDay === i ? null : i;
  }

  $: status = getOpenStatus(startHours || [], endHours || [], $minuteClock);
</script>

<div>
  {#if showTitle}
    <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Hours</h2>
  {/if}
  <div class="container">
    <div class="days">
      {#each dayData as day, i}
        <button
          type="button"
          class="day-pill"
          class:today={day.today}
          class:closed={day.closed}
          class:active={activeDay === i}
          on:mouseenter={() => (hoverDay = i)}
          on:mouseleave={() => (hoverDay = null)}
          on:focus={() => (hoverDay = i)}
          on:blur={() => (hoverDay = null)}
          on:click={() => togglePin(i)}
          aria-label={`${day.label}: ${day.times}`}
          aria-expanded={activeDay === i}
        >
          {#if activeDay === i}
            <span class="time-tip" role="tooltip">
              <strong>{day.label}</strong>&nbsp;{day.times}
            </span>
          {/if}
          <div class="track">
            {#each day.segments as seg}
              <div class="span" style="top:{seg.top}%; height:{Math.max(seg.height, 6)}%"></div>
            {/each}
          </div>
          <span class="day-letter">{day.label}</span>
        </button>
      {/each}
    </div>
    <div class="status" data-state={status.state}>
      <span class="status-dot"></span>
      {status.label}
    </div>
  </div>
</div>

<style>
  .container {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--line-1);
    border-radius: 8px;
    padding: 6px 10px;
    background: var(--surface-2);
  }

  .days {
    display: flex;
    gap: 4px;
  }

  .day-pill {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 3px 4px 2px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    font: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .day-pill.today {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .day-pill.active:not(.today) {
    border-color: var(--line-2);
    background: var(--surface-3);
  }

  /* Exact-times tooltip, shown on hover/focus or tap-pin */
  .time-tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    white-space: nowrap;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    background: var(--surface-1);
    color: var(--ink-1);
    border: 1px solid var(--line-1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 30;
    pointer-events: none;
  }

  .time-tip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: var(--line-1);
  }

  .time-tip strong {
    color: var(--accent-hover);
  }

  :global(.dark) .time-tip strong {
    color: var(--accent);
  }

  /* Edge pills: anchor the tooltip to the pill edge so it stays inside the card */
  .day-pill:nth-child(-n + 2) .time-tip {
    left: 0;
    transform: none;
  }

  .day-pill:nth-child(-n + 2) .time-tip::after {
    left: 12px;
  }

  .day-pill:nth-last-child(-n + 2) .time-tip {
    left: auto;
    right: 0;
    transform: none;
  }

  .day-pill:nth-last-child(-n + 2) .time-tip::after {
    left: auto;
    right: 7px;
  }

  .track {
    position: relative;
    width: 7px;
    height: 26px;
    border-radius: 4px;
    background: var(--line-1);
    overflow: hidden;
  }

  .span {
    position: absolute;
    left: 0;
    right: 0;
    border-radius: 3px;
    background: var(--accent);
  }

  .day-pill.closed .track {
    opacity: 0.45;
  }

  .day-letter {
    font-size: 9px;
    font-weight: 600;
    color: var(--ink-2);
    line-height: 1;
  }

  .day-pill.closed .day-letter {
    color: var(--ink-3);
  }

  .day-pill.today .day-letter {
    color: var(--accent-hover);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--error);
    flex-shrink: 0;
  }

  .status[data-state='open'] {
    color: var(--success);
  }

  .status[data-state='open'] .status-dot {
    background: var(--success);
  }

  .status[data-state='closing-soon'] {
    color: var(--warning);
  }

  .status[data-state='closing-soon'] .status-dot {
    background: var(--warning);
  }

  .status[data-state='unknown'] .status-dot {
    background: var(--ink-3);
  }
</style>

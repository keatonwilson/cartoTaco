<script>
  // Week Rhythm strip — 7 day pills with mini open-span bars on a shared 24h
  // scale, plus a calm open/closed status dot (V4 of the UI refresh).
  export let startHours;
  export let endHours;

  const DAYS = [
    { key: 'mon', label: 'Mo', dow: 1 },
    { key: 'tue', label: 'Tu', dow: 2 },
    { key: 'wed', label: 'We', dow: 3 },
    { key: 'thu', label: 'Th', dow: 4 },
    { key: 'fri', label: 'Fr', dow: 5 },
    { key: 'sat', label: 'Sa', dow: 6 },
    { key: 'sun', label: 'Su', dow: 0 }
  ];

  // Current day for the "today" ring (stable for the session)
  const currentDow = new Date().getDay();

  /** "11:00 AM" / "23:30" → minutes since midnight, or null */
  function parseTime(s) {
    if (!s || s === 'NA') return null;
    const [time, period] = String(s).trim().split(' ');
    let [h, m] = time.split(':').map(Number);
    if (isNaN(h)) return null;
    if (period) {
      if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    return h * 60 + (m || 0);
  }

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
        tooltip: closed ? `${label}: closed` : `${label}: ${startStr} – ${endStr}`
      };
    });
  })();

  /**
   * Open right now? Mirrors the isOpenNow() logic in stores.js (minute
   * precision, overnight-aware).
   */
  $: openNow = (() => {
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date();
    const todayKey = dayKeys[now.getDay()];
    const startObj = Object.fromEntries(startHours || []);
    const endObj = Object.fromEntries(endHours || []);

    const start = parseTime(startObj[`${todayKey}_start`]);
    const end = parseTime(endObj[`${todayKey}_end`]);
    if (start === null || end === null) return false;

    const current = now.getHours() * 60 + now.getMinutes();
    if (end < start) return current >= start || current <= end;
    return current >= start && current <= end;
  })();
</script>

<div>
  <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Hours</h2>
  <div class="container">
    <div class="days">
      {#each dayData as day}
        <div class="day-pill" class:today={day.today} class:closed={day.closed} title={day.tooltip}>
          <div class="track">
            {#each day.segments as seg}
              <div class="span" style="top:{seg.top}%; height:{Math.max(seg.height, 6)}%"></div>
            {/each}
          </div>
          <span class="day-letter">{day.label}</span>
        </div>
      {/each}
    </div>
    <div class="status" class:open={openNow}>
      <span class="status-dot"></span>
      {openNow ? 'Open Now' : 'Closed Now'}
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 3px 4px 2px;
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .day-pill.today {
    border-color: var(--accent);
    background: var(--accent-soft);
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

  .status.open {
    color: var(--success);
  }

  .status.open .status-dot {
    background: var(--success);
  }
</style>

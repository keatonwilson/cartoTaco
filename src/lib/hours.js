// Opening hours, always read on Tucson's clock. Every spot is in Tucson, so
// "open now" and "opens at 8" mean Tucson time whatever time zone the
// visitor's browser is in. Arizona doesn't observe DST, so America/Phoenix is
// a fixed UTC-7 all year.
import { readable } from 'svelte/store';

export const TUCSON_TZ = 'America/Phoenix';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CLOSING_SOON_MINUTES = 60;

const tucsonFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TUCSON_TZ,
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23'
});

/**
 * Day of week (0 = Sunday) and minutes since midnight in Tucson.
 * @param {Date} [date]
 * @returns {{ dow: number, minutes: number }}
 */
export function tucsonNow(date = new Date()) {
  const parts = Object.fromEntries(tucsonFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    dow: DAY_LABELS.indexOf(parts.weekday),
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute)
  };
}

/** "11:00 AM" / "23:30" / "9:00" → minutes since midnight, or null */
export function parseTime(s) {
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

/** Minutes since midnight → "8 AM", "9:30 PM", "noon", "midnight" */
export function formatTime(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m === 0) return 'midnight';
  if (m === 720) return 'noon';
  const h = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min ? `:${String(min).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Accepts the raw hours object from the view ({ mon_start, mon_end, … }) or
 * the [key, value] entry arrays processedTacoData carries as startHours/endHours.
 */
function toHoursObject(hours, endHours) {
  if (Array.isArray(hours)) {
    return Object.fromEntries([...hours, ...(endHours || [])]);
  }
  return hours || {};
}

/** One day's opening span, or null if closed/unknown that day */
function daySpan(hours, dow) {
  const key = DAY_KEYS[dow];
  const start = parseTime(hours[`${key}_start`]);
  const end = parseTime(hours[`${key}_end`]);
  if (start === null || end === null) return null;
  return {
    start,
    end,
    allDay: start === 0 && end >= 1439,
    // Ends at or before it starts: the span runs past midnight into the next day
    overnight: end <= start
  };
}

function openLabel(closesAt, minutesLeft) {
  return minutesLeft <= CLOSING_SOON_MINUTES
    ? { state: 'closing-soon', label: `Closes soon · ${formatTime(closesAt)}` }
    : { state: 'open', label: `Open til ${formatTime(closesAt)}` };
}

/**
 * Where a spot stands right now on Tucson's clock, phrased for people:
 * "Open til 10 PM", "Closes soon · 9:30 PM", "Opens at 8 AM",
 * "Opens tomorrow at 8 AM", "Opens Mon at 11 AM".
 *
 * @param {object|Array} hours - raw hours object, or startHours entries
 * @param {Array|Date} [endHoursOrDate] - endHours entries when passing arrays
 * @param {Date} [date]
 * @returns {{ isOpen: boolean, state: 'open'|'closing-soon'|'opens-later'|'closed'|'unknown', label: string }}
 */
export function getOpenStatus(hours, endHoursOrDate, date) {
  const now = endHoursOrDate instanceof Date ? endHoursOrDate : date || new Date();
  const h = toHoursObject(hours, Array.isArray(endHoursOrDate) ? endHoursOrDate : null);
  const spans = DAY_KEYS.map((_, dow) => daySpan(h, dow));

  if (spans.every((s) => s === null)) {
    return { isOpen: false, state: 'unknown', label: 'Hours unknown' };
  }

  const { dow, minutes } = tucsonNow(now);

  // Still inside last night's span, which ran past midnight
  const yesterday = spans[(dow + 6) % 7];
  if (yesterday && yesterday.overnight && !yesterday.allDay && minutes < yesterday.end) {
    return { isOpen: true, ...openLabel(yesterday.end, yesterday.end - minutes) };
  }

  const today = spans[dow];
  if (today) {
    if (today.allDay) {
      return { isOpen: true, state: 'open', label: 'Open 24 hours' };
    }
    if (minutes >= today.start && (today.overnight || minutes < today.end)) {
      const endAbs = today.overnight ? today.end + 1440 : today.end;
      return { isOpen: true, ...openLabel(today.end, endAbs - minutes) };
    }
    if (minutes < today.start) {
      return { isOpen: false, state: 'opens-later', label: `Opens at ${formatTime(today.start)}` };
    }
  }

  for (let k = 1; k <= 7; k++) {
    const next = spans[(dow + k) % 7];
    if (!next) continue;
    const when = k === 1 ? 'tomorrow' : DAY_LABELS[(dow + k) % 7];
    return { isOpen: false, state: 'closed', label: `Opens ${when} at ${formatTime(next.start)}` };
  }

  // Unreachable: at least one day has a span
  return { isOpen: false, state: 'closed', label: 'Closed' };
}

/**
 * Today's opening hours on Tucson's clock, for a "Today" line:
 * "8 AM – 10 PM", "Open 24 hours", "Closed today", or null when the spot has
 * no hours on record at all.
 */
export function todayHours(hours, endHoursOrDate, date) {
  const now = endHoursOrDate instanceof Date ? endHoursOrDate : date || new Date();
  const h = toHoursObject(hours, Array.isArray(endHoursOrDate) ? endHoursOrDate : null);
  const spans = DAY_KEYS.map((_, dow) => daySpan(h, dow));
  if (spans.every((s) => s === null)) return null;
  const today = spans[tucsonNow(now).dow];
  if (!today) return 'Closed today';
  if (today.allDay) return 'Open 24 hours';
  return `${formatTime(today.start)} – ${formatTime(today.end)}`;
}

/**
 * The current time, updated on each minute boundary, so status labels roll
 * over (7:59 "Opens at 8 AM" → 8:00 "Open til …") while a card is open.
 */
export const minuteClock = readable(new Date(), (set) => {
  if (typeof window === 'undefined') return;
  let timer;
  const schedule = () => {
    timer = setTimeout(() => {
      set(new Date());
      schedule();
    }, 60000 - (Date.now() % 60000) + 50);
  };
  set(new Date());
  schedule();
  return () => clearTimeout(timer);
});

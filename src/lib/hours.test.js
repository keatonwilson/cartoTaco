import { describe, it, expect } from 'vitest';
import { tucsonNow, parseTime, formatTime, getOpenStatus, todayHours } from './hours.js';

// Tucson is UTC-7 all year, so these UTC instants are fixed Tucson wall times
// whatever time zone the test runner is in. Wed Feb 18, 2026.
const tucson = (hhmm, day = 18) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 1, day, h + 7, m));
};

const weekdays = { wed_start: '9:00', wed_end: '22:00' };

describe('tucsonNow', () => {
  it('reads the wall clock in Tucson, not the runtime zone', () => {
    expect(tucsonNow(tucson('8:00'))).toEqual({ dow: 3, minutes: 480 });
  });

  it('rolls the day over at Tucson midnight', () => {
    // 23:30 Tucson Wednesday is already Thursday in UTC
    expect(tucsonNow(tucson('23:30'))).toEqual({ dow: 3, minutes: 1410 });
  });
});

describe('parseTime / formatTime', () => {
  it('parses 24h and AM/PM strings', () => {
    expect(parseTime('9:00')).toBe(540);
    expect(parseTime('11:30 PM')).toBe(1410);
    expect(parseTime('12:00 AM')).toBe(0);
    expect(parseTime('NA')).toBe(null);
    expect(parseTime(null)).toBe(null);
  });

  it('formats times the way people say them', () => {
    expect(formatTime(480)).toBe('8 AM');
    expect(formatTime(1290)).toBe('9:30 PM');
    expect(formatTime(720)).toBe('noon');
    expect(formatTime(0)).toBe('midnight');
    expect(formatTime(1440)).toBe('midnight');
  });
});

describe('getOpenStatus', () => {
  it('says when it opens later today', () => {
    expect(getOpenStatus(weekdays, tucson('7:30'))).toEqual({
      isOpen: false,
      state: 'opens-later',
      label: 'Opens at 9 AM'
    });
  });

  it('says when it closes while open', () => {
    expect(getOpenStatus(weekdays, tucson('12:00'))).toEqual({
      isOpen: true,
      state: 'open',
      label: 'Open til 10 PM'
    });
  });

  it('flags the last hour as closing soon', () => {
    expect(getOpenStatus(weekdays, tucson('21:00')).state).toBe('closing-soon');
    expect(getOpenStatus(weekdays, tucson('21:15')).label).toBe('Closes soon · 10 PM');
    expect(getOpenStatus(weekdays, tucson('20:59')).state).toBe('open');
  });

  it('is closed at closing time', () => {
    expect(getOpenStatus(weekdays, tucson('22:00')).isOpen).toBe(false);
  });

  it('points to tomorrow after closing', () => {
    const hours = { ...weekdays, thu_start: '8:00', thu_end: '14:00' };
    expect(getOpenStatus(hours, tucson('22:30')).label).toBe('Opens tomorrow at 8 AM');
  });

  it('names the weekday when the next opening is further out', () => {
    const hours = { mon_start: '11:00', mon_end: '15:00' };
    expect(getOpenStatus(hours, tucson('12:00')).label).toBe('Opens Mon at 11 AM');
  });

  it('wraps a week to the same weekday', () => {
    expect(getOpenStatus(weekdays, tucson('23:00')).label).toBe('Opens Wed at 9 AM');
  });

  it('stays open past midnight on an overnight span', () => {
    const hours = { wed_start: '18:00', wed_end: '2:00' };
    expect(getOpenStatus(hours, tucson('23:00'))).toMatchObject({ isOpen: true, label: 'Open til 2 AM' });
    // Thursday 1:30 AM — still Wednesday night's span
    expect(getOpenStatus(hours, tucson('1:30', 19))).toMatchObject({
      isOpen: true,
      state: 'closing-soon',
      label: 'Closes soon · 2 AM'
    });
    expect(getOpenStatus(hours, tucson('2:30', 19)).isOpen).toBe(false);
  });

  it('reads 0:00–23:59 as open all day', () => {
    const hours = { wed_start: '0:00', wed_end: '23:59' };
    expect(getOpenStatus(hours, tucson('3:00'))).toMatchObject({ isOpen: true, label: 'Open 24 hours' });
  });

  it('reports unknown hours when no day has any', () => {
    expect(getOpenStatus({}, tucson('12:00')).state).toBe('unknown');
    expect(getOpenStatus(null, tucson('12:00')).label).toBe('Hours unknown');
    expect(getOpenStatus({ wed_start: '9:00', wed_end: 'NA' }, tucson('12:00')).state).toBe('unknown');
  });

  it('accepts the startHours/endHours entry arrays', () => {
    const start = [['wed_start', '9:00']];
    const end = [['wed_end', '22:00']];
    expect(getOpenStatus(start, end, tucson('12:00')).label).toBe('Open til 10 PM');
  });
});

describe('todayHours', () => {
  it("spells out today's span on Tucson's clock", () => {
    expect(todayHours(weekdays, tucson('7:00'))).toBe('9 AM – 10 PM');
  });

  it('says closed today, open 24 hours, or nothing at all', () => {
    expect(todayHours({ mon_start: '9:00', mon_end: '17:00' }, tucson('12:00'))).toBe('Closed today');
    expect(todayHours({ wed_start: '0:00', wed_end: '23:59' }, tucson('12:00'))).toBe('Open 24 hours');
    expect(todayHours({}, tucson('12:00'))).toBe(null);
  });

  it('accepts the startHours/endHours entry arrays', () => {
    expect(todayHours([['wed_start', '18:00']], [['wed_end', '2:00']], tucson('12:00'))).toBe('6 PM – 2 AM');
  });
});

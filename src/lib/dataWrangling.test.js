import { describe, it, expect } from 'vitest';
import {
  filterObjectByKeySubstring,
  getTopFive,
  percentageOfMaxArray,
  convertHoursData
} from './dataWrangling.js';

describe('filterObjectByKeySubstring', () => {
  it('returns matching key-value pairs', () => {
    const obj = { chicken_perc: 0.5, beef_perc: 0.3, name: 'Test' };
    const result = filterObjectByKeySubstring(obj, 'perc');
    expect(result).toEqual([
      ['chicken_perc', 0.5],
      ['beef_perc', 0.3]
    ]);
  });

  it('returns empty array when no matches', () => {
    const obj = { name: 'Test', type: 'Truck' };
    expect(filterObjectByKeySubstring(obj, 'perc')).toEqual([]);
  });

  it('returns empty array for empty object', () => {
    expect(filterObjectByKeySubstring({}, 'perc')).toEqual([]);
  });
});

describe('getTopFive', () => {
  it('sorts by value descending and returns top 5', () => {
    const arr = [
      ['a_perc', 0.1],
      ['b_perc', 0.9],
      ['c_perc', 0.5],
      ['d_perc', 0.3],
      ['e_perc', 0.7],
      ['f_perc', 0.2]
    ];
    const result = getTopFive(arr);
    expect(result).toHaveLength(5);
    expect(result[0][0]).toBe('b');
    expect(result[0][1]).toBe(0.9);
    expect(result[1][0]).toBe('e');
  });

  it('strips _perc suffix from keys', () => {
    const arr = [['chicken_perc', 0.8]];
    const result = getTopFive(arr);
    expect(result[0][0]).toBe('chicken');
  });

  it('handles arrays with fewer than 5 items', () => {
    const arr = [['a_perc', 0.5], ['b_perc', 0.3]];
    const result = getTopFive(arr);
    expect(result).toHaveLength(2);
  });
});

describe('percentageOfMaxArray', () => {
  it('converts values to percentages of max', () => {
    const result = percentageOfMaxArray([50, 100, 25]);
    expect(result).toEqual([50, 100, 25]);
  });

  it('handles array where all values are equal', () => {
    const result = percentageOfMaxArray([10, 10, 10]);
    expect(result).toEqual([100, 100, 100]);
  });

  it('handles single element', () => {
    const result = percentageOfMaxArray([42]);
    expect(result).toEqual([100]);
  });
});

describe('convertHoursData', () => {
  it('converts start/end time arrays into day objects', () => {
    const startTimes = [
      ['mon_start', '9:00'],
      ['tue_start', '10:00']
    ];
    const endTimes = [
      ['mon_end', '17:00'],
      ['tue_end', '18:00']
    ];
    const result = convertHoursData(startTimes, endTimes);

    // Monday should be first
    expect(result[0]).toEqual({ day: 'Mo', open: '9', close: '17', closed: false });
    expect(result[1]).toEqual({ day: 'Tu', open: '10', close: '18', closed: false });
  });

  it('marks days with NA end time as closed', () => {
    const startTimes = [['mon_start', '9:00']];
    const endTimes = [['mon_end', 'NA']];
    const result = convertHoursData(startTimes, endTimes);
    expect(result[0].closed).toBe(true);
    expect(result[0].open).toBe('');
  });

  it('marks days with missing times as closed', () => {
    const result = convertHoursData([], []);
    result.forEach(day => {
      expect(day.closed).toBe(true);
    });
  });

  it('returns all 7 days in Mon-Sun order', () => {
    const result = convertHoursData([], []);
    expect(result).toHaveLength(7);
    expect(result.map(d => d.day)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  });
});

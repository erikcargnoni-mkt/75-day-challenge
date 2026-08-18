import { describe, it, expect } from 'vitest';
import {
  initialState,
  logPeriodStart,
  setWeight,
  startChallenge,
  toggleBoolTask,
} from './challenge';
import { addDays, type ISODate } from './date';
import { readingStats, weightTrend } from './insights';
import { DEFAULT_PROFILE, type AppState } from './types';

const START: ISODate = '2026-03-01';

function withWeights(kgs: (number | null)[]): AppState {
  let s = logPeriodStart(
    startChallenge(initialState({ ...DEFAULT_PROFILE, weightKg: 60 }), START),
    START,
  );
  kgs.forEach((kg, i) => {
    if (kg !== null) s = setWeight(s, addDays(START, i), kg);
  });
  return s;
}

describe('weightTrend', () => {
  it('is empty until something is logged', () => {
    const t = weightTrend(withWeights([]));
    expect(t.points).toEqual([]);
    expect(t.latest).toBeNull();
    expect(t.change).toBeNull();
  });

  it('withholds the average until a full 7-day window exists', () => {
    const t = weightTrend(withWeights([60, 60, 60, 60, 60, 60]));
    expect(t.points.every((p) => p.avg === null)).toBe(true);
    expect(t.change).toBeNull();
  });

  it('smooths over a trailing 7 entries', () => {
    const t = weightTrend(withWeights([60, 60, 60, 60, 60, 60, 67]));
    expect(t.points[6].avg).toBeCloseTo(61, 5);
  });

  it('reports change on the smoothed line, not on two noisy mornings', () => {
    // A single 5kg spike on the last day must not read as +5kg of progress.
    const kgs = [60, 60, 60, 60, 60, 60, 60, 65];
    const t = weightTrend(withWeights(kgs));
    expect(t.latest).toBe(65);
    expect(t.change).toBeCloseTo(0.714, 2);
  });

  it('tracks the raw range for the chart domain', () => {
    const t = weightTrend(withWeights([60, 58.5, 62.25]));
    expect(t.min).toBe(58.5);
    expect(t.max).toBe(62.25);
  });

  it('tags each reading with the phase it fell in', () => {
    const t = weightTrend(withWeights([60, null, null, null, null, null, null, 60]));
    expect(t.points[0].phase).toBe('menstrual'); // cycle day 1
    expect(t.points[1].phase).toBe('follicular'); // cycle day 8
  });

  it('keeps readings in date order regardless of logging order', () => {
    let s = withWeights([]);
    s = setWeight(s, addDays(START, 3), 61);
    s = setWeight(s, START, 60);
    s = setWeight(s, addDays(START, 1), 59);
    expect(weightTrend(s).points.map((p) => p.kg)).toEqual([60, 59, 61]);
  });
});

describe('readingStats', () => {
  const read = (state: AppState, ...offsets: number[]) =>
    offsets.reduce((s, o) => toggleBoolTask(s, addDays(START, o), 'reading'), state);

  const base = () =>
    logPeriodStart(
      startChallenge(initialState({ ...DEFAULT_PROFILE, readingPages: 10 }), START),
      START,
    );

  it('is empty before anything is read', () => {
    const s = readingStats(base(), START);
    expect(s).toMatchObject({ daysRead: 0, currentStreak: 0, longestStreak: 0, pages: 0 });
  });

  it('counts a run ending today', () => {
    const state = read(base(), 0, 1, 2);
    const s = readingStats(state, addDays(START, 2));
    expect(s.currentStreak).toBe(3);
    expect(s.readToday).toBe(true);
  });

  /*
   * The streak must not read as broken every morning before she has picked up a
   * book — that would punish her for the time of day.
   */
  it('holds the streak through a day that has not been logged yet', () => {
    const state = read(base(), 0, 1, 2);
    const s = readingStats(state, addDays(START, 3));
    expect(s.currentStreak).toBe(3);
    expect(s.readToday).toBe(false);
  });

  it('drops the streak once a whole day has been skipped', () => {
    const state = read(base(), 0, 1, 2);
    expect(readingStats(state, addDays(START, 4)).currentStreak).toBe(0);
  });

  it('remembers the longest run after a break', () => {
    const state = read(base(), 0, 1, 2, 3, 6);
    const s = readingStats(state, addDays(START, 6));
    expect(s.longestStreak).toBe(4);
    expect(s.currentStreak).toBe(1);
    expect(s.daysRead).toBe(5);
  });

  it('estimates pages from the daily target', () => {
    expect(readingStats(read(base(), 0, 1, 2), START).pages).toBe(30);
  });

  it('never counts a day twice', () => {
    let state = read(base(), 0);
    state = toggleBoolTask(state, START, 'reading'); // un-tick
    state = toggleBoolTask(state, START, 'reading'); // re-tick
    expect(readingStats(state, START).daysRead).toBe(1);
  });
});

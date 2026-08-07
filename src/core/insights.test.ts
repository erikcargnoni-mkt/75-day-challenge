import { describe, it, expect } from 'vitest';
import { initialState, logPeriodStart, setWeight, startChallenge } from './challenge';
import { addDays, type ISODate } from './date';
import { weightTrend } from './insights';
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

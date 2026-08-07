import { describe, it, expect } from 'vitest';
import {
  addWater,
  completeWorkout,
  dayStatus,
  initialState,
  logPeriodStart,
  reconcile,
  requiredTasks,
  startChallenge,
  toggleBoolTask,
} from './challenge';
import { addDays, type ISODate } from './date';
import { DEFAULT_PROFILE, type AppState } from './types';

const START: ISODate = '2026-03-01';

function fresh(): AppState {
  const s = initialState({ ...DEFAULT_PROFILE, weightKg: 60, nutritionPlan: 'No alcohol' });
  return logPeriodStart(startChallenge(s, START), START);
}

/** Check off every required task for `date`. */
function completeDay(state: AppState, date: ISODate): AppState {
  const status = dayStatus(state, state.current!, date);
  let s = state;
  s = completeWorkout(s, date, status.targets.workout.band);
  s = toggleBoolTask(s, date, 'walk');
  s = toggleBoolTask(s, date, 'nutrition');
  s = toggleBoolTask(s, date, 'reading');
  s = addWater(s, date, status.targets.waterMl);
  if (status.targets.photoDue) s = toggleBoolTask(s, date, 'photo');
  return s;
}

describe('requiredTasks', () => {
  it('adds the photo only on photo days', () => {
    expect(requiredTasks(1)).toContain('photo');
    expect(requiredTasks(2)).not.toContain('photo');
    expect(requiredTasks(2)).toEqual(['workout', 'walk', 'water', 'nutrition', 'reading']);
  });
});

describe('day completion', () => {
  it('is incomplete until every required task is done', () => {
    let s = fresh();
    expect(dayStatus(s, s.current!, START).complete).toBe(false);
    s = completeDay(s, START);
    expect(dayStatus(s, s.current!, START).complete).toBe(true);
  });

  it('treats water as done only at the full target', () => {
    let s = fresh();
    const target = dayStatus(s, s.current!, START).targets.waterMl;
    s = addWater(s, START, target - 50);
    expect(dayStatus(s, s.current!, START).missing).toContain('water');
    s = addWater(s, START, 50);
    expect(dayStatus(s, s.current!, START).missing).not.toContain('water');
  });

  it('lets a downshifted workout complete the day', () => {
    let s = fresh();
    // Day 1 is menstrual day 1, so the prescription is already restorative;
    // move to a follicular day where the prescription is 'build'.
    const d = addDays(START, 8);
    s = completeWorkout(s, d, 'restorative');
    const log = s.current!.days[d];
    expect(log.workout!.done).toBe(true);
    expect(log.workout!.overridden).toBe(true);
    expect(dayStatus(s, s.current!, d).missing).not.toContain('workout');
  });

  it('walks reachedDay back when a task is un-checked', () => {
    let s = completeDay(fresh(), START);
    expect(s.current!.reachedDay).toBe(1);
    s = toggleBoolTask(s, START, 'reading');
    expect(s.current!.reachedDay).toBe(0);
  });
});

describe('reconcile', () => {
  it('leaves today alone — the day is not over yet', () => {
    const s = fresh();
    const after = reconcile(s, START);
    expect(after.current).not.toBeNull();
    expect(after.notice).toBeUndefined();
  });

  it('resets the challenge when a past day was left incomplete', () => {
    const s = fresh();
    const after = reconcile(s, addDays(START, 1));
    expect(after.current).toBeNull();
    expect(after.notice?.kind).toBe('reset');
    expect(after.notice?.reachedDay).toBe(0);
    expect(after.history).toHaveLength(1);
    expect(after.history[0].failedOn).toBe(START);
  });

  it('reports which tasks were missed', () => {
    let s = fresh();
    s = toggleBoolTask(s, START, 'walk');
    s = toggleBoolTask(s, START, 'reading');
    const after = reconcile(s, addDays(START, 1));
    expect(after.notice?.missed).toEqual(['workout', 'water', 'nutrition', 'photo']);
  });

  it('resets on days the app was never opened at all', () => {
    let s = fresh();
    s = completeDay(s, START);
    // Two days pass untouched.
    const after = reconcile(s, addDays(START, 3));
    expect(after.current).toBeNull();
    expect(after.notice?.reachedDay).toBe(1);
    expect(after.history[0].failedOn).toBe(addDays(START, 1));
  });

  it('carries a clean streak forward', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = completeDay(s, addDays(START, i));
    const after = reconcile(s, addDays(START, 3));
    expect(after.current).not.toBeNull();
    expect(after.current!.reachedDay).toBe(3);
    expect(after.notice).toBeUndefined();
  });

  it('completes the challenge after 75 clean days', () => {
    let s = fresh();
    for (let i = 0; i < 75; i++) s = completeDay(s, addDays(START, i));
    const after = reconcile(s, addDays(START, 75));
    expect(after.current).toBeNull();
    expect(after.notice?.kind).toBe('completed');
    expect(after.history[0].outcome).toBe('completed');
    expect(after.history[0].reachedDay).toBe(75);
  });

  it('does nothing before the start date', () => {
    const s = startChallenge(initialState(), addDays(START, 5));
    expect(reconcile(s, START).current).not.toBeNull();
  });
});

describe('period logging', () => {
  it('keeps starts unique and sorted', () => {
    let s = initialState();
    s = logPeriodStart(s, '2026-04-01');
    s = logPeriodStart(s, '2026-03-01');
    s = logPeriodStart(s, '2026-04-01');
    expect(s.cycle.periodStarts).toEqual(['2026-03-01', '2026-04-01']);
  });
});

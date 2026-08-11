import { describe, it, expect } from 'vitest';
import {
  addWater,
  attemptProgress,
  carryOn,
  completeWorkout,
  dayStatus,
  initialState,
  isCleanRun,
  logPeriodStart,
  reconcile,
  requiredTasks,
  setMeditation,
  setOutdoor,
  setWeight,
  startChallenge,
  startOver,
  toggleBoolTask,
  weightOn,
  weightSeries,
} from './challenge';
import { addDays, type ISODate } from './date';
import { DEFAULT_MEDITATION, DEFAULT_PROFILE, type AppState } from './types';

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
  s = setOutdoor(s, date, 'walk');
  s = setMeditation(s, date, DEFAULT_MEDITATION);
  s = toggleBoolTask(s, date, 'nutrition');
  s = toggleBoolTask(s, date, 'reading');
  s = toggleBoolTask(s, date, 'photo');
  s = addWater(s, date, status.targets.waterMl);
  return s;
}

describe('requiredTasks', () => {
  it('is the same seven tasks every day', () => {
    expect(requiredTasks()).toEqual([
      'workout',
      'outdoor',
      'water',
      'nutrition',
      'reading',
      'meditation',
      'photo',
    ]);
  });

  it('does not require the weigh-in', () => {
    expect(requiredTasks()).not.toContain('weight');
  });
});

describe('outdoor time', () => {
  it('completes at either mode and records which', () => {
    let s = setOutdoor(fresh(), START, 'run');
    expect(s.current!.days[START].outdoor).toEqual({ done: true, mode: 'run' });
    expect(dayStatus(s, s.current!, START).missing).not.toContain('outdoor');

    s = setOutdoor(s, START, 'walk');
    expect(s.current!.days[START].outdoor!.mode).toBe('walk');
  });
});

describe('meditation', () => {
  it('completes at any offered length', () => {
    for (const minutes of [5, 10, 15, 20] as const) {
      const s = setMeditation(fresh(), START, minutes);
      expect(s.current!.days[START].meditation).toEqual({ done: true, minutes });
      expect(dayStatus(s, s.current!, START).missing).not.toContain('meditation');
    }
  });
});

describe('weight', () => {
  it('is logged without ever affecting completion', () => {
    let s = completeDay(fresh(), START);
    expect(dayStatus(s, s.current!, START).complete).toBe(true);
    s = setWeight(s, START, 61.4);
    expect(dayStatus(s, s.current!, START).complete).toBe(true);

    // And a day with only a weigh-in is still nowhere near done.
    const bare = setWeight(fresh(), START, 61.4);
    expect(dayStatus(bare, bare.current!, START).complete).toBe(false);
  });

  it('drives the water target from the most recent weigh-in', () => {
    let s = fresh();
    expect(weightOn(s, START)).toBe(60);
    const before = dayStatus(s, s.current!, START).targets.waterMl;
    s = setWeight(s, START, 66);
    expect(weightOn(s, START)).toBe(66);
    // START is menstrual day 1, so the 1.05 phase multiplier applies on top:
    // 66kg × 35ml × 1.05 = 2425.5, rounded to the nearest 50.
    expect(dayStatus(s, s.current!, START).targets.waterMl).toBe(2450);
    expect(before).toBeLessThan(2450);
  });

  it('does not let a later weigh-in leak backwards', () => {
    const later = addDays(START, 5);
    const s = setWeight(fresh(), later, 70);
    expect(weightOn(s, START)).toBe(60);
    expect(weightOn(s, later)).toBe(70);
  });

  it('rejects junk instead of storing it', () => {
    const s = setWeight(fresh(), START, 0);
    expect(s.current!.days[START].weightKg).toBeUndefined();
  });

  it('returns weigh-ins oldest first', () => {
    let s = fresh();
    s = setWeight(s, addDays(START, 2), 61);
    s = setWeight(s, START, 60);
    expect(weightSeries(s)).toEqual([
      { date: START, kg: 60 },
      { date: addDays(START, 2), kg: 61 },
    ]);
  });
});

describe('rule changes', () => {
  it('does not retroactively fail days that were already signed off', () => {
    // A day closed out under the current rules.
    let s = completeDay(fresh(), START);
    expect(s.current!.days[START].completedAt).toBeDefined();

    // Now a new task appears — simulated by wiping one that was satisfied,
    // which is exactly the shape of "the rules grew overnight".
    s = {
      ...s,
      current: {
        ...s.current!,
        days: { ...s.current!.days, [START]: { ...s.current!.days[START], meditation: undefined } },
      },
    };

    const after = reconcile(s, addDays(START, 1));
    expect(after.current).not.toBeNull();
    expect(after.notice).toBeUndefined();
  });

  it('still raises a day that was never signed off', () => {
    const after = reconcile(fresh(), addDays(START, 1));
    expect(after.pending?.days).toHaveLength(1);
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
    // Day 1 is menstrual day 1, where the prescription is already restorative;
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
    expect(after.pending).toBeUndefined();
  });

  it('raises a decision instead of wiping the attempt', () => {
    const s = fresh();
    const after = reconcile(s, addDays(START, 1));
    expect(after.current).not.toBeNull(); // progress is NOT destroyed
    expect(after.history).toHaveLength(0);
    expect(after.pending?.days).toHaveLength(1);
    expect(after.pending?.days[0].date).toBe(START);
    expect(after.pending?.days[0].dayIndex).toBe(1);
  });

  it('reports which tasks were missed', () => {
    let s = fresh();
    s = setOutdoor(s, START, 'run');
    s = toggleBoolTask(s, START, 'reading');
    const after = reconcile(s, addDays(START, 1));
    expect(after.pending?.days[0].missed).toEqual([
      'workout',
      'water',
      'nutrition',
      'meditation',
      'photo',
    ]);
  });

  it('collects every unfinished day, including ones never opened', () => {
    let s = fresh();
    s = completeDay(s, START);
    const after = reconcile(s, addDays(START, 3));
    expect(after.current).not.toBeNull();
    expect(after.pending?.days.map((d) => d.dayIndex)).toEqual([2, 3]);
  });

  it('carries a clean streak forward with nothing pending', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = completeDay(s, addDays(START, i));
    const after = reconcile(s, addDays(START, 3));
    expect(after.current!.reachedDay).toBe(3);
    expect(after.pending).toBeUndefined();
  });

  it('completes the challenge after 75 clean days', () => {
    let s = fresh();
    for (let i = 0; i < 75; i++) s = completeDay(s, addDays(START, i));
    const after = reconcile(s, addDays(START, 75));
    expect(after.current).toBeNull();
    expect(after.notice?.kind).toBe('completed');
    expect(after.history[0].outcome).toBe('completed');
    expect(isCleanRun(after.history[0])).toBe(true);
  });

  it('does nothing before the start date', () => {
    const s = startChallenge(initialState(), addDays(START, 5));
    expect(reconcile(s, START).current).not.toBeNull();
  });
});

describe('carrying a missed day', () => {
  it('keeps the attempt and its day count', () => {
    let s = fresh();
    s = completeDay(s, START);
    s = reconcile(s, addDays(START, 2)); // day 2 unfinished
    expect(s.pending?.days).toHaveLength(1);

    s = carryOn(s);
    expect(s.pending).toBeUndefined();
    expect(s.current).not.toBeNull();
    expect(s.current!.carried).toEqual([addDays(START, 1)]);
    expect(s.current!.reachedDay).toBe(1);
  });

  it('does not raise the same day twice', () => {
    let s = carryOn(reconcile(fresh(), addDays(START, 1)));
    s = reconcile(s, addDays(START, 1));
    expect(s.pending).toBeUndefined();
  });

  it('raises a new decision for a later miss', () => {
    let s = carryOn(reconcile(fresh(), addDays(START, 1)));
    s = reconcile(s, addDays(START, 2));
    expect(s.pending?.days.map((d) => d.dayIndex)).toEqual([2]);
  });

  it('finishes the run but never as a clean 75', () => {
    let s = fresh();
    for (let i = 1; i < 75; i++) s = completeDay(s, addDays(START, i)); // day 1 skipped
    s = reconcile(s, addDays(START, 75));
    s = carryOn(s);
    s = reconcile(s, addDays(START, 75));

    const done = s.history[0];
    expect(done.outcome).toBe('completed');
    expect(done.carried).toEqual([START]);
    expect(isCleanRun(done)).toBe(false);
    expect(done.reachedDay).toBe(75);
  });

  it('accumulates carried days across separate decisions', () => {
    let s = carryOn(reconcile(fresh(), addDays(START, 1)));
    s = carryOn(reconcile(s, addDays(START, 3)));
    expect(s.current!.carried).toEqual([START, addDays(START, 1), addDays(START, 2)]);
  });
});

describe('starting over', () => {
  it('files the old attempt and opens a fresh day 1 today', () => {
    let s = fresh();
    s = completeDay(s, START);
    s = reconcile(s, addDays(START, 2));

    const restarted = startOver(s, addDays(START, 2));
    expect(restarted.pending).toBeUndefined();
    expect(restarted.history).toHaveLength(1);
    expect(restarted.history[0].outcome).toBe('failed');
    expect(restarted.history[0].reachedDay).toBe(1);
    expect(restarted.current!.startDate).toBe(addDays(START, 2));
    expect(restarted.current!.reachedDay).toBe(0);
  });

  it('keeps the old logs in history rather than deleting them', () => {
    let s = completeDay(fresh(), START);
    s = startOver(reconcile(s, addDays(START, 2)), addDays(START, 2));
    expect(Object.keys(s.history[0].days)).toContain(START);
  });
});

describe('attemptProgress', () => {
  it('separates clean days from carried ones', () => {
    let s = fresh();
    s = completeDay(s, START);
    s = completeDay(s, addDays(START, 2));
    s = carryOn(reconcile(s, addDays(START, 3)));

    const p = attemptProgress(s, s.current!, addDays(START, 3));
    expect(p.cleanDays).toBe(2);
    expect(p.carriedDays).toBe(1);
    expect(p.dayIndex).toBe(4);
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

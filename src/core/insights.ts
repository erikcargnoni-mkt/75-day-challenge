import { dayStatus, targetsForDate } from './challenge';
import { phaseFor } from './cycle';
import type { AppState, Attempt, DayLog, Phase } from './types';

/**
 * What 75 days of logging is actually for.
 *
 * The interesting question is not "did she finish" — the streak already answers
 * that. It is which phase costs her the most, and whether the prescribed bands
 * match what her body actually did. If she downshifts every luteal day, the
 * model is wrong for her and the app should be honest about it.
 */

export interface PhaseStat {
  phase: Phase;
  days: number;
  completeDays: number;
  /** Share of workouts trained below the prescribed band. */
  downshiftRate: number | null;
  avgEnergy: number | null;
  avgMood: number | null;
  avgCramps: number | null;
  avgSleep: number | null;
  waterAdherence: number | null;
}

const PHASES: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Drop unlogged entries — symptoms are optional, so most days have gaps. */
function defined(xs: (number | undefined)[]): number[] {
  return xs.filter((n): n is number => n !== undefined);
}

export function phaseStats(state: AppState, attempts: Attempt[]): PhaseStat[] {
  const buckets = new Map<Phase, { logs: DayLog[]; complete: number; waterRatio: number[] }>();
  for (const p of PHASES) buckets.set(p, { logs: [], complete: 0, waterRatio: [] });

  for (const attempt of attempts) {
    for (const log of Object.values(attempt.days)) {
      const info = phaseFor(log.date, state.cycle, state.profile);
      if (!info) continue;
      const bucket = buckets.get(info.phase)!;
      bucket.logs.push(log);
      if (dayStatus(state, attempt, log.date).complete) bucket.complete += 1;
      const target = targetsForDate(state, log.date, log.dayIndex).waterMl;
      if (target > 0) bucket.waterRatio.push(Math.min(1, (log.water ?? 0) / target));
    }
  }

  return PHASES.map((phase) => {
    const b = buckets.get(phase)!;
    const workouts = b.logs.map((l) => l.workout).filter((w): w is NonNullable<typeof w> => !!w?.done);
    return {
      phase,
      days: b.logs.length,
      completeDays: b.complete,
      downshiftRate: workouts.length
        ? workouts.filter((w) => w.overridden).length / workouts.length
        : null,
      avgEnergy: mean(defined(b.logs.map((l) => l.symptoms?.energy))),
      avgMood: mean(defined(b.logs.map((l) => l.symptoms?.mood))),
      avgCramps: mean(defined(b.logs.map((l) => l.symptoms?.cramps))),
      avgSleep: mean(defined(b.logs.map((l) => l.symptoms?.sleepHours))),
      waterAdherence: mean(b.waterRatio),
    };
  });
}

export interface Overview {
  attemptsMade: number;
  bestDay: number;
  totalDaysLogged: number;
  totalWorkouts: number;
  downshifts: number;
}

export function overview(state: AppState): Overview {
  const all = state.current ? [...state.history, state.current] : state.history;
  const logs = all.flatMap((a) => Object.values(a.days));
  const workouts = logs.map((l) => l.workout).filter((w) => w?.done);
  return {
    attemptsMade: all.length,
    bestDay: all.reduce((m, a) => Math.max(m, a.reachedDay), 0),
    totalDaysLogged: logs.filter((l) => l.completedAt).length,
    totalWorkouts: workouts.length,
    downshifts: workouts.filter((w) => w?.overridden).length,
  };
}

/**
 * A plain-language read on whether the prescribed bands fit this body.
 * Returns null when there is not enough data to say anything honest.
 */
export function bandFitMessage(stats: PhaseStat[]): string | null {
  const luteal = stats.find((s) => s.phase === 'luteal');
  const follicular = stats.find((s) => s.phase === 'follicular');

  if (luteal && luteal.days >= 10 && luteal.downshiftRate !== null && luteal.downshiftRate > 0.5) {
    return 'You downshift on more than half your luteal days. The prescribed band is probably too high for you in that phase — consider lowering it in Settings rather than fighting it every cycle.';
  }
  if (
    follicular &&
    follicular.days >= 10 &&
    follicular.downshiftRate !== null &&
    follicular.downshiftRate < 0.1
  ) {
    return 'You hit the prescribed band on nearly every follicular day. That window is where your progress is being made — protect it.';
  }
  return null;
}

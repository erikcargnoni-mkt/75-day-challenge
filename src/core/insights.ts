import { dayStatus, targetsForDate, weightSeries } from './challenge';
import { phaseFor } from './cycle';
import type { ISODate } from './date';
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
  avgWeight: number | null;
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
      const target = targetsForDate(state, log.date).waterMl;
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
      avgWeight: mean(defined(b.logs.map((l) => l.weightKg))),
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
  /** Days kept rather than restarted over. Never quietly forgotten. */
  carried: number;
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
    carried: all.reduce((n, a) => n + (a.carried?.length ?? 0), 0),
  };
}

export interface WeightPoint {
  date: ISODate;
  kg: number;
  /** Trailing 7-entry mean. Null until there are seven weigh-ins. */
  avg: number | null;
  phase: Phase | null;
}

export interface WeightTrend {
  points: WeightPoint[];
  first: number | null;
  latest: number | null;
  /** Change measured on the smoothed line, not on two noisy single mornings. */
  change: number | null;
  min: number;
  max: number;
}

const AVG_WINDOW = 7;

/**
 * Daily weight is mostly noise — food, salt, sleep, and in the luteal phase
 * several days of fluid retention that has nothing to do with fat. So the line
 * the app draws is the trailing average, and the raw mornings sit behind it.
 * Reading a single morning's number as progress is the mistake this is built to
 * prevent.
 */
export function weightTrend(state: AppState): WeightTrend {
  const raw = weightSeries(state);
  const points: WeightPoint[] = raw.map((p, i) => {
    const window = raw.slice(Math.max(0, i - AVG_WINDOW + 1), i + 1);
    return {
      date: p.date,
      kg: p.kg,
      avg: window.length === AVG_WINDOW ? window.reduce((a, b) => a + b.kg, 0) / AVG_WINDOW : null,
      phase: phaseFor(p.date, state.cycle, state.profile)?.phase ?? null,
    };
  });

  const smoothed = points.map((p) => p.avg).filter((n): n is number => n !== null);
  const kgs = raw.map((p) => p.kg);

  return {
    points,
    first: raw.length ? raw[0].kg : null,
    latest: raw.length ? raw[raw.length - 1].kg : null,
    change:
      smoothed.length >= 2 ? smoothed[smoothed.length - 1] - smoothed[0] : null,
    min: kgs.length ? Math.min(...kgs) : 0,
    max: kgs.length ? Math.max(...kgs) : 0,
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

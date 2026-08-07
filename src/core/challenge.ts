import { phaseFor } from './cycle';
import { addDays, daysBetween, type ISODate } from './date';
import { isDownshift, targetsFor, type DayTargets } from './targets';
import {
  CHALLENGE_LENGTH,
  SCHEMA_VERSION,
  DEFAULT_PROFILE,
  type AppState,
  type Attempt,
  type DayLog,
  type IntensityBand,
  type MeditationMinutes,
  type OutdoorMode,
  type Profile,
  type Symptoms,
  type TaskId,
} from './types';

/**
 * Streak rules.
 *
 * Rigid by design. Every required task, every day, or the challenge restarts at
 * day 1 — that unforgiving quality is the whole mechanism, and softening it
 * would leave a habit tracker wearing a challenge's name.
 *
 * The one thing that is *not* rigid is how hard the workout has to be. Training
 * below the prescribed band is recorded as a downshift and completes the day.
 * Skipping it does not.
 */

export function newAttempt(startDate: ISODate): Attempt {
  return {
    id: `${startDate}-${Math.random().toString(36).slice(2, 8)}`,
    startDate,
    outcome: 'active',
    reachedDay: 0,
    days: {},
  };
}

export function initialState(profile: Profile = DEFAULT_PROFILE): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    cycle: { periodStarts: [] },
    current: null,
    history: [],
  };
}

export function dayIndexFor(attempt: Attempt, date: ISODate): number {
  return daysBetween(attempt.startDate, date) + 1;
}

export function dateForDayIndex(attempt: Attempt, dayIndex: number): ISODate {
  return addDays(attempt.startDate, dayIndex - 1);
}

export function blankLog(date: ISODate, dayIndex: number): DayLog {
  return { date, dayIndex, water: 0 };
}

/** Every weigh-in across every attempt, oldest first. */
export function weightSeries(state: AppState): { date: ISODate; kg: number }[] {
  const attempts = state.current ? [...state.history, state.current] : state.history;
  return attempts
    .flatMap((a) => Object.values(a.days))
    .filter((l): l is DayLog & { weightKg: number } => l.weightKg !== undefined)
    .map((l) => ({ date: l.date, kg: l.weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function logFor(attempt: Attempt, date: ISODate): DayLog {
  return attempt.days[date] ?? blankLog(date, dayIndexFor(attempt, date));
}

/**
 * The daily set. Weight is deliberately absent: it is measured, not scored.
 * Forgetting the scale should not cost seventy-five days of work.
 */
export const REQUIRED_TASKS: TaskId[] = [
  'workout',
  'outdoor',
  'water',
  'nutrition',
  'reading',
  'meditation',
  'photo',
];

export function requiredTasks(): TaskId[] {
  return REQUIRED_TASKS;
}

/**
 * The weight the day's water target is scaled from: her most recent weigh-in on
 * or before that date, falling back to the profile figure from setup.
 */
export function weightOn(state: AppState, date: ISODate): number {
  const attempts = state.current ? [...state.history, state.current] : state.history;
  let best: { date: ISODate; kg: number } | null = null;
  for (const attempt of attempts) {
    for (const log of Object.values(attempt.days)) {
      if (log.weightKg === undefined || log.date > date) continue;
      if (!best || log.date > best.date) best = { date: log.date, kg: log.weightKg };
    }
  }
  return best?.kg ?? state.profile.weightKg;
}

export function targetsForDate(state: AppState, date: ISODate): DayTargets {
  return targetsFor(state.profile, phaseFor(date, state.cycle, state.profile), weightOn(state, date));
}

export function isTaskDone(log: DayLog, task: TaskId, targets: DayTargets): boolean {
  switch (task) {
    case 'workout':
      return log.workout?.done === true;
    case 'outdoor':
      return log.outdoor?.done === true;
    case 'water':
      return (log.water ?? 0) >= targets.waterMl;
    case 'nutrition':
      return log.nutrition === true;
    case 'reading':
      return log.reading === true;
    case 'meditation':
      return log.meditation?.done === true;
    case 'photo':
      return log.photo === true;
  }
}

export function missingTasks(log: DayLog, targets: DayTargets): TaskId[] {
  return requiredTasks().filter((t) => !isTaskDone(log, t, targets));
}

/** Does this log satisfy the rules *as they stand right now*? */
export function meetsRequirements(log: DayLog, targets: DayTargets): boolean {
  return missingTasks(log, targets).length === 0;
}

/**
 * Whether a day counts as done.
 *
 * A day that was already signed off stays signed off, even if the rules later
 * grow. Without this, adding a task would make every past day retroactively
 * incomplete and reconcile() would reset a legitimate streak to day 1 on the
 * next launch — punishing her for a change she did not make. `completedAt` is
 * cleared whenever a task is un-ticked, so this can only ever grandfather a day
 * that genuinely met the rules in force at the time.
 */
export function isDayComplete(log: DayLog, targets: DayTargets): boolean {
  return log.completedAt !== undefined || meetsRequirements(log, targets);
}

export interface DayStatus {
  date: ISODate;
  dayIndex: number;
  log: DayLog;
  targets: DayTargets;
  done: TaskId[];
  missing: TaskId[];
  complete: boolean;
}

export function dayStatus(state: AppState, attempt: Attempt, date: ISODate): DayStatus {
  const dayIndex = dayIndexFor(attempt, date);
  const log = logFor(attempt, date);
  const targets = targetsForDate(state, date);
  const required = requiredTasks();
  const missing = required.filter((t) => !isTaskDone(log, t, targets));
  return {
    date,
    dayIndex,
    log,
    targets,
    done: required.filter((t) => !missing.includes(t)),
    missing,
    complete: isDayComplete(log, targets),
  };
}

/**
 * Bring state up to date with the calendar.
 *
 * Called on load and on every day rollover. Any past day left incomplete fails
 * the attempt on that date — including days when the app was never opened, which
 * is the point: the challenge does not pause because you looked away.
 */
export function reconcile(state: AppState, today: ISODate): AppState {
  const attempt = state.current;
  if (!attempt || attempt.outcome !== 'active') return state;

  // Nothing to judge before the attempt has started.
  if (daysBetween(attempt.startDate, today) < 0) return state;

  const lastJudgeable = Math.min(
    daysBetween(attempt.startDate, today) - 1,
    CHALLENGE_LENGTH - 1,
  );

  let reachedDay = attempt.reachedDay;

  for (let i = 0; i <= lastJudgeable; i++) {
    const date = addDays(attempt.startDate, i);
    const status = dayStatus(state, attempt, date);
    if (!status.complete) {
      const failed: Attempt = {
        ...attempt,
        outcome: 'failed',
        failedOn: date,
        reachedDay,
      };
      return {
        ...state,
        current: null,
        history: [...state.history, failed],
        notice: {
          kind: 'reset',
          date,
          reachedDay,
          missed: status.missing,
        },
      };
    }
    reachedDay = Math.max(reachedDay, status.dayIndex);
  }

  // Day 75 signed off — the attempt is finished.
  if (reachedDay >= CHALLENGE_LENGTH) {
    const done: Attempt = { ...attempt, outcome: 'completed', reachedDay: CHALLENGE_LENGTH };
    return {
      ...state,
      current: null,
      history: [...state.history, done],
      notice: { kind: 'completed', date: dateForDayIndex(attempt, CHALLENGE_LENGTH), reachedDay: CHALLENGE_LENGTH },
    };
  }

  if (reachedDay === attempt.reachedDay) return state;
  return { ...state, current: { ...attempt, reachedDay } };
}

// ---------------------------------------------------------------------------
// Mutations. All pure: take state, return new state.
// ---------------------------------------------------------------------------

function withLog(state: AppState, date: ISODate, mutate: (log: DayLog) => DayLog): AppState {
  const attempt = state.current;
  if (!attempt) return state;
  const dayIndex = dayIndexFor(attempt, date);
  if (dayIndex < 1 || dayIndex > CHALLENGE_LENGTH) return state;

  const next = mutate(logFor(attempt, date));
  // Deliberately the strict check, not isDayComplete: sign-off has to be earned
  // against today's rules before it can be grandfathered against tomorrow's.
  const complete = meetsRequirements(next, targetsForDate(state, date));

  // Un-checking a task can walk the day back out of "done", so reachedDay has to
  // be able to move down as well as up.
  let reachedDay = attempt.reachedDay;
  if (complete) reachedDay = Math.max(reachedDay, dayIndex);
  else if (reachedDay === dayIndex) reachedDay = dayIndex - 1;

  return {
    ...state,
    current: {
      ...attempt,
      reachedDay,
      days: {
        ...attempt.days,
        [date]: {
          ...next,
          completedAt: complete ? (next.completedAt ?? new Date().toISOString()) : undefined,
        },
      },
    },
  };
}

export function toggleBoolTask(
  state: AppState,
  date: ISODate,
  task: 'nutrition' | 'reading' | 'photo',
): AppState {
  return withLog(state, date, (log) => ({ ...log, [task]: !log[task] }));
}

export function setOutdoor(state: AppState, date: ISODate, mode: OutdoorMode): AppState {
  return withLog(state, date, (log) => ({ ...log, outdoor: { done: true, mode } }));
}

export function clearOutdoor(state: AppState, date: ISODate): AppState {
  return withLog(state, date, (log) => ({ ...log, outdoor: undefined }));
}

export function setMeditation(
  state: AppState,
  date: ISODate,
  minutes: MeditationMinutes,
): AppState {
  return withLog(state, date, (log) => ({ ...log, meditation: { done: true, minutes } }));
}

export function clearMeditation(state: AppState, date: ISODate): AppState {
  return withLog(state, date, (log) => ({ ...log, meditation: undefined }));
}

/** Tracked, not scored — logging it never affects whether the day is complete. */
export function setWeight(state: AppState, date: ISODate, kg: number | undefined): AppState {
  return withLog(state, date, (log) => ({
    ...log,
    weightKg: kg === undefined || Number.isNaN(kg) || kg <= 0 ? undefined : kg,
  }));
}

export function addWater(state: AppState, date: ISODate, ml: number): AppState {
  return withLog(state, date, (log) => ({ ...log, water: Math.max(0, (log.water ?? 0) + ml) }));
}

export function setWater(state: AppState, date: ISODate, ml: number): AppState {
  return withLog(state, date, (log) => ({ ...log, water: Math.max(0, ml) }));
}

export function completeWorkout(
  state: AppState,
  date: ISODate,
  band: IntensityBand,
  note?: string,
): AppState {
  const attempt = state.current;
  if (!attempt) return state;
  const prescribed = targetsForDate(state, date).workout.band;
  return withLog(state, date, (log) => ({
    ...log,
    workout: { done: true, band, overridden: isDownshift(prescribed, band), note },
  }));
}

export function clearWorkout(state: AppState, date: ISODate): AppState {
  return withLog(state, date, (log) => ({ ...log, workout: undefined }));
}

export function setSymptoms(state: AppState, date: ISODate, symptoms: Symptoms): AppState {
  return withLog(state, date, (log) => ({ ...log, symptoms: { ...log.symptoms, ...symptoms } }));
}

export function startChallenge(state: AppState, startDate: ISODate): AppState {
  return { ...state, current: newAttempt(startDate), notice: undefined };
}

/** Abandon the running attempt without waiting for a missed day to do it. */
export function abandonChallenge(state: AppState, today: ISODate): AppState {
  const attempt = state.current;
  if (!attempt) return state;
  return {
    ...state,
    current: null,
    history: [...state.history, { ...attempt, outcome: 'failed', failedOn: today }],
    notice: undefined,
  };
}

export function logPeriodStart(state: AppState, date: ISODate): AppState {
  if (state.cycle.periodStarts.includes(date)) return state;
  return {
    ...state,
    cycle: { ...state.cycle, periodStarts: [...state.cycle.periodStarts, date].sort() },
  };
}

export function removePeriodStart(state: AppState, date: ISODate): AppState {
  return {
    ...state,
    cycle: { ...state.cycle, periodStarts: state.cycle.periodStarts.filter((d) => d !== date) },
  };
}

export function updateProfile(state: AppState, patch: Partial<Profile>): AppState {
  return { ...state, profile: { ...state.profile, ...patch } };
}

export function dismissNotice(state: AppState): AppState {
  return { ...state, notice: undefined };
}

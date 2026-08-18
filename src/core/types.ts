import type { ISODate } from './date';

export const CHALLENGE_LENGTH = 75;
export const SCHEMA_VERSION = 2;

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

/**
 * How hard the body is expected to be able to go today.
 * The daily workout is always required; the band is what "done" means.
 */
export type IntensityBand = 'restorative' | 'steady' | 'build' | 'peak';

export const BAND_ORDER: IntensityBand[] = ['restorative', 'steady', 'build', 'peak'];

export type TaskId =
  | 'workout'
  | 'outdoor'
  | 'water'
  | 'nutrition'
  | 'coldShower'
  | 'meditation'
  | 'photo'
  | 'reading';

/** How the 30 outdoor minutes were spent. Both count equally. */
export type OutdoorMode = 'walk' | 'run';

export type MeditationMinutes = 5 | 10 | 15 | 20;
export const MEDITATION_OPTIONS: MeditationMinutes[] = [5, 10, 15, 20];
export const DEFAULT_MEDITATION: MeditationMinutes = 10;

export interface Profile {
  name: string;
  /** Starting weight. Superseded by the most recent daily weigh-in once she logs one. */
  weightKg: number;
  /** Used until enough real cycles are logged to compute a rolling average. */
  defaultCycleLength: number;
  periodLength: number;
  /** Free text: the eating approach she committed to for the full 75 days. */
  nutritionPlan: string;
  readingPages: number;
  outdoorMinutes: number;
  workoutMinutes: number;
}

export interface CycleState {
  /** Ascending ISO dates of logged period starts. */
  periodStarts: ISODate[];
}

export interface Symptoms {
  energy?: 1 | 2 | 3 | 4 | 5;
  mood?: 1 | 2 | 3 | 4 | 5;
  cramps?: 0 | 1 | 2 | 3;
  sleepHours?: number;
  note?: string;
}

export interface WorkoutLog {
  done: boolean;
  /** The band actually trained. May be below the prescribed band — that is allowed. */
  band: IntensityBand;
  /** True when she chose a band below what the app prescribed. Never breaks the streak. */
  overridden: boolean;
  note?: string;
}

export interface OutdoorLog {
  done: boolean;
  mode: OutdoorMode;
}

export interface MeditationLog {
  done: boolean;
  minutes: MeditationMinutes;
}

export interface DayLog {
  date: ISODate;
  dayIndex: number; // 1..75
  workout?: WorkoutLog;
  outdoor?: OutdoorLog;
  /** Millilitres logged so far. */
  water?: number;
  nutrition?: boolean;
  coldShower?: boolean;
  /** Optional pillar: logged and celebrated, never required. See REQUIRED_TASKS. */
  reading?: boolean;
  meditation?: MeditationLog;
  photo?: boolean;
  /** Morning weigh-in. Tracked, never required — see requiredTasks(). */
  weightKg?: number;
  symptoms?: Symptoms;
  /**
   * Set the moment the day first satisfied the rules, and cleared if a task is
   * un-ticked. Its presence is what makes a past day permanently signed off:
   * see isDayComplete().
   */
  completedAt?: string; // ISO timestamp
}

export type AttemptOutcome = 'active' | 'failed' | 'completed';

export interface Attempt {
  id: string;
  startDate: ISODate;
  outcome: AttemptOutcome;
  /** The date whose tasks were left incomplete, for a failed attempt. */
  failedOn?: ISODate;
  /** Highest day index fully completed. */
  reachedDay: number;
  /**
   * Days she was shown as unfinished and chose to carry rather than restart.
   * Permanent: a carried day never becomes a clean one, so a run finished with
   * entries here is never reported as a clean 75.
   */
  carried?: ISODate[];
  days: Record<ISODate, DayLog>;
}

/** One unfinished past day, waiting on her decision. */
export interface MissedDay {
  date: ISODate;
  dayIndex: number;
  missed: TaskId[];
}

/**
 * Raised by reconcile() when past days were left unfinished. The app blocks on
 * this until she chooses — carrying on or starting over is her call to make,
 * not something the app decides while she isn't looking.
 */
export interface PendingDecision {
  attemptId: string;
  days: MissedDay[];
}

/**
 * The run finished. Persisted so a reload can't swallow the moment.
 *
 * There is deliberately no "reset" notice: the app no longer resets anything on
 * its own. Unfinished days raise a PendingDecision instead.
 */
export interface Notice {
  kind: 'completed';
  date: ISODate;
  reachedDay: number;
}

export interface AppState {
  schemaVersion: number;
  profile: Profile;
  cycle: CycleState;
  current: Attempt | null;
  history: Attempt[];
  notice?: Notice;
  pending?: PendingDecision;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  weightKg: 60,
  defaultCycleLength: 28,
  periodLength: 5,
  nutritionPlan: '',
  readingPages: 10,
  outdoorMinutes: 30,
  workoutMinutes: 45,
};

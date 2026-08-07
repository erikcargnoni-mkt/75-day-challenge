import type { ISODate } from './date';

export const CHALLENGE_LENGTH = 75;
export const SCHEMA_VERSION = 1;

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

/**
 * How hard the body is expected to be able to go today.
 * The daily workout is always required; the band is what "done" means.
 */
export type IntensityBand = 'restorative' | 'steady' | 'build' | 'peak';

export const BAND_ORDER: IntensityBand[] = ['restorative', 'steady', 'build', 'peak'];

export type TaskId = 'workout' | 'walk' | 'water' | 'nutrition' | 'reading' | 'photo';

export interface Profile {
  name: string;
  weightKg: number;
  /** Used until enough real cycles are logged to compute a rolling average. */
  defaultCycleLength: number;
  periodLength: number;
  /** Free text: the eating approach she committed to for the full 75 days. */
  nutritionPlan: string;
  readingPages: number;
  walkMinutes: number;
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

export interface DayLog {
  date: ISODate;
  dayIndex: number; // 1..75
  workout?: WorkoutLog;
  walk?: boolean;
  /** Millilitres logged so far. */
  water?: number;
  nutrition?: boolean;
  reading?: boolean;
  photo?: boolean;
  symptoms?: Symptoms;
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
  days: Record<ISODate, DayLog>;
}

/**
 * Something the app decided on the user's behalf while she wasn't looking
 * (a reset, a completion). Persisted so a reload can't swallow the explanation.
 */
export interface Notice {
  kind: 'reset' | 'completed';
  date: ISODate;
  reachedDay: number;
  missed?: TaskId[];
}

export interface AppState {
  schemaVersion: number;
  profile: Profile;
  cycle: CycleState;
  current: Attempt | null;
  history: Attempt[];
  notice?: Notice;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  weightKg: 60,
  defaultCycleLength: 28,
  periodLength: 5,
  nutritionPlan: '',
  readingPages: 10,
  walkMinutes: 30,
  workoutMinutes: 45,
};

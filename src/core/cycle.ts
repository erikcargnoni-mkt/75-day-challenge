import { addDays, clamp, daysBetween, type ISODate } from './date';
import type { CycleState, Phase, Profile } from './types';

/**
 * Cycle phase estimation.
 *
 * The model is deliberately simple and stated plainly rather than dressed up as
 * medicine: the luteal phase is the near-constant part of a cycle (~14 days), so
 * ovulation is estimated by counting *backwards* from the next expected period
 * rather than forwards from the last one. Cycle length itself comes from the
 * user's own logged period starts once there are enough of them.
 *
 * These are estimates. Nothing here detects ovulation or predicts fertility.
 */

export const MIN_CYCLE = 21;
export const MAX_CYCLE = 40;
/** Days before the next period that the app treats as the low-capacity window. */
export const LATE_LUTEAL_DAYS = 4;
const LUTEAL_LENGTH = 14;

export interface PhaseInfo {
  /** 1-based day of the current cycle. */
  cycleDay: number;
  cycleLength: number;
  phase: Phase;
  /** 1-based day within the current phase. */
  dayInPhase: number;
  /** Last few days before the expected period — the lowest-capacity window. */
  isLateLuteal: boolean;
  /** Days until the next expected period start. */
  daysToNextPeriod: number;
  /** False when we are extrapolating far past the last logged period start. */
  confident: boolean;
}

/** Intervals between consecutive logged period starts, in days. */
export function cycleIntervals(periodStarts: ISODate[]): number[] {
  const sorted = [...periodStarts].sort();
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1], sorted[i]);
    // Discard implausible gaps: a mis-tap or a skipped log shouldn't drag the average.
    if (gap >= MIN_CYCLE && gap <= MAX_CYCLE) out.push(gap);
  }
  return out;
}

/**
 * Rolling estimate of cycle length. Uses the median of the last 6 intervals —
 * median rather than mean so one unusual cycle doesn't shift the whole model.
 */
export function estimateCycleLength(cycle: CycleState, profile: Profile): number {
  const intervals = cycleIntervals(cycle.periodStarts).slice(-6);
  if (intervals.length === 0) return clamp(profile.defaultCycleLength, MIN_CYCLE, MAX_CYCLE);
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  return clamp(median, MIN_CYCLE, MAX_CYCLE);
}

/** The most recent logged period start on or before `date`, if any. */
export function lastPeriodStartOnOrBefore(
  periodStarts: ISODate[],
  date: ISODate,
): ISODate | null {
  const past = periodStarts.filter((s) => s <= date).sort();
  return past.length ? past[past.length - 1] : null;
}

/** Estimated day of ovulation, counted back from the next expected period. */
export function ovulationDay(cycleLength: number): number {
  return clamp(cycleLength - LUTEAL_LENGTH, 10, 21);
}

/**
 * Which cycle day `date` falls on. Projects forward from the last logged start,
 * wrapping by the estimated cycle length when a period start wasn't logged.
 */
export function cycleDayFor(
  date: ISODate,
  cycle: CycleState,
  cycleLength: number,
): { cycleDay: number; cyclesProjected: number } | null {
  const anchor = lastPeriodStartOnOrBefore(cycle.periodStarts, date);
  if (!anchor) return null;
  const elapsed = daysBetween(anchor, date);
  const cyclesProjected = Math.floor(elapsed / cycleLength);
  return { cycleDay: (elapsed % cycleLength) + 1, cyclesProjected };
}

export function phaseForCycleDay(
  cycleDay: number,
  cycleLength: number,
  periodLength: number,
): { phase: Phase; dayInPhase: number; isLateLuteal: boolean } {
  const period = clamp(periodLength, 1, 10);
  const ovu = ovulationDay(cycleLength);
  // Fertile-window framing: the ovulatory phase spans the day before through the
  // day after estimated ovulation.
  const ovuStart = ovu - 1;
  const ovuEnd = ovu + 1;

  if (cycleDay <= period) {
    return { phase: 'menstrual', dayInPhase: cycleDay, isLateLuteal: false };
  }
  if (cycleDay < ovuStart) {
    return { phase: 'follicular', dayInPhase: cycleDay - period, isLateLuteal: false };
  }
  if (cycleDay <= ovuEnd) {
    return { phase: 'ovulatory', dayInPhase: cycleDay - ovuStart + 1, isLateLuteal: false };
  }
  return {
    phase: 'luteal',
    dayInPhase: cycleDay - ovuEnd,
    isLateLuteal: cycleLength - cycleDay < LATE_LUTEAL_DAYS,
  };
}

export function phaseFor(date: ISODate, cycle: CycleState, profile: Profile): PhaseInfo | null {
  const cycleLength = estimateCycleLength(cycle, profile);
  const cd = cycleDayFor(date, cycle, cycleLength);
  if (!cd) return null;
  const p = phaseForCycleDay(cd.cycleDay, cycleLength, profile.periodLength);
  return {
    cycleDay: cd.cycleDay,
    cycleLength,
    phase: p.phase,
    dayInPhase: p.dayInPhase,
    isLateLuteal: p.isLateLuteal,
    daysToNextPeriod: cycleLength - cd.cycleDay + 1,
    // After two unlogged cycles the projection is guesswork; the UI says so.
    confident: cd.cyclesProjected < 2,
  };
}

/** Expected period start dates covering [from, to], for the calendar overlay. */
export function projectedPeriodStarts(
  cycle: CycleState,
  profile: Profile,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const cycleLength = estimateCycleLength(cycle, profile);
  const anchor = lastPeriodStartOnOrBefore(cycle.periodStarts, to) ?? cycle.periodStarts[0];
  if (!anchor) return [];

  const out: ISODate[] = [];
  // Walk back to before `from`, then forward across the window.
  let cursor = anchor;
  while (daysBetween(from, cursor) > 0) cursor = addDays(cursor, -cycleLength);
  while (cursor <= to) {
    if (cursor >= from) out.push(cursor);
    cursor = addDays(cursor, cycleLength);
  }
  return out;
}

export const PHASE_LABEL: Record<Phase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

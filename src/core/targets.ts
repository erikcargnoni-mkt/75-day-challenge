import type { PhaseInfo } from './cycle';
import { clamp } from './date';
import { BAND_ORDER, type IntensityBand, type Profile } from './types';

/**
 * Phase-relative targets.
 *
 * The streak is rigid: every required task must be checked, every day, or the
 * challenge restarts at day 1. What moves is the *definition of done* for the
 * two pillars where physiology actually changes capacity — training intensity
 * and hydration. Outdoor time, nutrition, reading, meditation and the photo are
 * constants by design: the challenge needs a spine that never bends.
 *
 * Walk-or-run and meditation length are the user's call, not the app's. They are
 * recorded because they are worth knowing later, not scored.
 */

/** Baseline hydration, before phase adjustment. */
const ML_PER_KG = 35;
const WATER_FLOOR_ML = 1800;
const WATER_CEILING_ML = 4000;

export interface WorkoutTarget {
  minutes: number;
  band: IntensityBand;
  headline: string;
  guidance: string;
  caution?: string;
}

export interface DayTargets {
  workout: WorkoutTarget;
  outdoorMinutes: number;
  waterMl: number;
  readingPages: number;
  nutritionPlan: string;
  /** Why today's targets look the way they do. Shown under the phase badge. */
  rationale: string;
}

export const BAND_LABEL: Record<IntensityBand, string> = {
  restorative: 'Restorative',
  steady: 'Steady',
  build: 'Build',
  peak: 'Peak',
};

export const BAND_BLURB: Record<IntensityBand, string> = {
  restorative: 'Mobility, walking, easy swim, yoga, technique work. Nothing that leaves a mark.',
  steady: 'Aerobic base, moderate strength, bag work at conversational effort.',
  build: 'Progressive strength, hard intervals, sparring. Push the top end.',
  peak: 'Your strongest window. Test lifts, hardest rounds, personal records.',
};

function bandFor(info: PhaseInfo): { band: IntensityBand; rationale: string; caution?: string } {
  switch (info.phase) {
    case 'menstrual':
      // Day 1–2 is usually the worst of it; by day 3 most people are climbing again.
      return info.dayInPhase <= 2
        ? {
            band: 'restorative',
            rationale: 'First days of your period. Movement helps, load does not.',
          }
        : {
            band: 'steady',
            rationale: 'Bleeding but past the worst. Capacity is coming back — use it gently.',
          };
    case 'follicular':
      return {
        band: 'build',
        rationale: 'Rising estrogen. This is when your body handles hard work best. Go get it.',
      };
    case 'ovulatory':
      return {
        band: 'peak',
        rationale: 'Peak strength window. If you want a record, today is the day.',
        caution:
          'Ligaments are laxer around ovulation. Warm up properly and keep landings and pivots clean.',
      };
    case 'luteal':
      return info.isLateLuteal
        ? {
            band: 'restorative',
            rationale:
              'Late luteal. Your period is close, energy is at its floor and heat is harder to shed. Show up, keep it light.',
          }
        : {
            band: 'steady',
            rationale:
              'Luteal phase. Aerobic work feels fine, top-end effort will feel harder than the numbers say.',
          };
  }
}

function waterMultiplier(info: PhaseInfo): number {
  switch (info.phase) {
    case 'menstrual':
      return 1.05;
    case 'luteal':
      // Counterintuitive but correct: drinking more helps the fluid retention, not less.
      return info.isLateLuteal ? 1.12 : 1.08;
    default:
      return 1.0;
  }
}

/** Scaled from the most recent weigh-in, so the target tracks the body it is for. */
export function waterTargetMl(weightKg: number, info: PhaseInfo | null): number {
  const base = weightKg * ML_PER_KG * (info ? waterMultiplier(info) : 1);
  const rounded = Math.round(base / 50) * 50;
  return clamp(rounded, WATER_FLOOR_ML, WATER_CEILING_ML);
}

/**
 * Targets for a given day. `info` is null when no period has been logged yet —
 * the app then falls back to neutral targets rather than guessing.
 */
export function targetsFor(
  profile: Profile,
  info: PhaseInfo | null,
  weightKg: number,
): DayTargets {
  const b = info
    ? bandFor(info)
    : {
        band: 'steady' as IntensityBand,
        rationale: 'No period logged yet, so targets are neutral. Log a period start to tune them.',
        caution: undefined,
      };

  return {
    workout: {
      minutes: profile.workoutMinutes,
      band: b.band,
      headline: `${profile.workoutMinutes} min · ${BAND_LABEL[b.band]}`,
      guidance: BAND_BLURB[b.band],
      caution: b.caution,
    },
    outdoorMinutes: profile.outdoorMinutes,
    waterMl: waterTargetMl(weightKg, info),
    readingPages: profile.readingPages,
    nutritionPlan: profile.nutritionPlan,
    rationale: b.rationale,
  };
}

/** True when the band actually trained is below the prescribed one. */
export function isDownshift(prescribed: IntensityBand, actual: IntensityBand): boolean {
  return BAND_ORDER.indexOf(actual) < BAND_ORDER.indexOf(prescribed);
}

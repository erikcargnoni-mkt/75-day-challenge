import { describe, it, expect } from 'vitest';
import type { PhaseInfo } from './cycle';
import { isDownshift, targetsFor, waterTargetMl } from './targets';
import { DEFAULT_PROFILE, type Profile } from './types';

const profile: Profile = { ...DEFAULT_PROFILE, weightKg: 60, nutritionPlan: 'No sugar, no alcohol' };
const T = (info: Parameters<typeof targetsFor>[1], kg = 60) => targetsFor(profile, info, kg);

const info = (over: Partial<PhaseInfo>): PhaseInfo => ({
  cycleDay: 10,
  cycleLength: 28,
  phase: 'follicular',
  dayInPhase: 5,
  isLateLuteal: false,
  daysToNextPeriod: 19,
  confident: true,
  ...over,
});

describe('workout band', () => {
  it('goes restorative on the first two days of bleeding, then steady', () => {
    expect(T(info({ phase: 'menstrual', dayInPhase: 1 })).workout.band).toBe(
      'restorative',
    );
    expect(T(info({ phase: 'menstrual', dayInPhase: 2 })).workout.band).toBe(
      'restorative',
    );
    expect(T(info({ phase: 'menstrual', dayInPhase: 3 })).workout.band).toBe(
      'steady',
    );
  });

  it('opens up through follicular and peaks at ovulation', () => {
    expect(T(info({ phase: 'follicular' })).workout.band).toBe('build');
    expect(T(info({ phase: 'ovulatory' })).workout.band).toBe('peak');
  });

  it('warns about joint laxity only in the ovulatory window', () => {
    expect(T(info({ phase: 'ovulatory' })).workout.caution).toMatch(/laxer/i);
    expect(T(info({ phase: 'follicular' })).workout.caution).toBeUndefined();
  });

  it('backs off in late luteal but not in early luteal', () => {
    expect(
      T(info({ phase: 'luteal', isLateLuteal: false })).workout.band,
    ).toBe('steady');
    expect(T(info({ phase: 'luteal', isLateLuteal: true })).workout.band).toBe(
      'restorative',
    );
  });

  it('stays neutral when no period has been logged', () => {
    const t = T(null);
    expect(t.workout.band).toBe('steady');
    expect(t.rationale).toMatch(/log a period start/i);
  });

  it('never drops the workout requirement, only its intensity', () => {
    for (const phase of ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const) {
      expect(T(info({ phase })).workout.minutes).toBe(45);
    }
  });
});

describe('water target', () => {
  it('scales with bodyweight, not a flat gallon', () => {
    expect(waterTargetMl(60, null)).toBe(2100);
    expect(waterTargetMl(75, null)).toBe(2650);
  });

  it('follows the most recent weigh-in rather than the setup figure', () => {
    expect(T(null, 60).waterMl).toBe(2100);
    expect(T(null, 66).waterMl).toBe(2300);
  });

  it('rises through the luteal phase', () => {
    const neutral = waterTargetMl(60, info({ phase: 'follicular' }));
    const luteal = waterTargetMl(60, info({ phase: 'luteal' }));
    const late = waterTargetMl(60, info({ phase: 'luteal', isLateLuteal: true }));
    expect(luteal).toBeGreaterThan(neutral);
    expect(late).toBeGreaterThan(luteal);
  });

  it('stays inside sane bounds at extreme bodyweights', () => {
    expect(waterTargetMl(40, null)).toBe(1800);
    expect(waterTargetMl(150, null)).toBe(4000);
  });
});

describe('constants that must not bend', () => {
  it('keeps outdoor time, reading and nutrition identical in every phase', () => {
    const phases = ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const;
    const all = phases.map((phase) => T(info({ phase })));
    expect(new Set(all.map((t) => t.outdoorMinutes)).size).toBe(1);
    expect(new Set(all.map((t) => t.readingPages)).size).toBe(1);
    expect(new Set(all.map((t) => t.nutritionPlan)).size).toBe(1);
  });
});

describe('isDownshift', () => {
  it('only counts training below what was prescribed', () => {
    expect(isDownshift('peak', 'steady')).toBe(true);
    expect(isDownshift('steady', 'peak')).toBe(false);
    expect(isDownshift('steady', 'steady')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import type { PhaseInfo } from './cycle';
import { isDownshift, isPhotoDay, targetsFor, waterTargetMl } from './targets';
import { DEFAULT_PROFILE, type Profile } from './types';

const profile: Profile = { ...DEFAULT_PROFILE, weightKg: 60, nutritionPlan: 'No sugar, no alcohol' };

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
    expect(targetsFor(profile, info({ phase: 'menstrual', dayInPhase: 1 }), 1).workout.band).toBe(
      'restorative',
    );
    expect(targetsFor(profile, info({ phase: 'menstrual', dayInPhase: 2 }), 1).workout.band).toBe(
      'restorative',
    );
    expect(targetsFor(profile, info({ phase: 'menstrual', dayInPhase: 3 }), 1).workout.band).toBe(
      'steady',
    );
  });

  it('opens up through follicular and peaks at ovulation', () => {
    expect(targetsFor(profile, info({ phase: 'follicular' }), 1).workout.band).toBe('build');
    expect(targetsFor(profile, info({ phase: 'ovulatory' }), 1).workout.band).toBe('peak');
  });

  it('warns about joint laxity only in the ovulatory window', () => {
    expect(targetsFor(profile, info({ phase: 'ovulatory' }), 1).workout.caution).toMatch(/laxer/i);
    expect(targetsFor(profile, info({ phase: 'follicular' }), 1).workout.caution).toBeUndefined();
  });

  it('backs off in late luteal but not in early luteal', () => {
    expect(
      targetsFor(profile, info({ phase: 'luteal', isLateLuteal: false }), 1).workout.band,
    ).toBe('steady');
    expect(targetsFor(profile, info({ phase: 'luteal', isLateLuteal: true }), 1).workout.band).toBe(
      'restorative',
    );
  });

  it('stays neutral when no period has been logged', () => {
    const t = targetsFor(profile, null, 1);
    expect(t.workout.band).toBe('steady');
    expect(t.rationale).toMatch(/log a period start/i);
  });

  it('never drops the workout requirement, only its intensity', () => {
    for (const phase of ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const) {
      expect(targetsFor(profile, info({ phase }), 1).workout.minutes).toBe(45);
    }
  });
});

describe('water target', () => {
  it('scales with bodyweight, not a flat gallon', () => {
    expect(waterTargetMl({ ...profile, weightKg: 60 }, null)).toBe(2100);
    expect(waterTargetMl({ ...profile, weightKg: 75 }, null)).toBe(2650);
  });

  it('rises through the luteal phase', () => {
    const neutral = waterTargetMl(profile, info({ phase: 'follicular' }));
    const luteal = waterTargetMl(profile, info({ phase: 'luteal' }));
    const late = waterTargetMl(profile, info({ phase: 'luteal', isLateLuteal: true }));
    expect(luteal).toBeGreaterThan(neutral);
    expect(late).toBeGreaterThan(luteal);
  });

  it('stays inside sane bounds at extreme bodyweights', () => {
    expect(waterTargetMl({ ...profile, weightKg: 40 }, null)).toBe(1800);
    expect(waterTargetMl({ ...profile, weightKg: 150 }, null)).toBe(4000);
  });
});

describe('constants that must not bend', () => {
  it('keeps walk, reading and nutrition identical in every phase', () => {
    const phases = ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const;
    const all = phases.map((phase) => targetsFor(profile, info({ phase }), 1));
    expect(new Set(all.map((t) => t.walkMinutes)).size).toBe(1);
    expect(new Set(all.map((t) => t.readingPages)).size).toBe(1);
    expect(new Set(all.map((t) => t.nutritionPlan)).size).toBe(1);
  });
});

describe('photo schedule', () => {
  it('falls on day 1 and then weekly', () => {
    expect(isPhotoDay(1)).toBe(true);
    expect(isPhotoDay(8)).toBe(true);
    expect(isPhotoDay(71)).toBe(true);
    expect(isPhotoDay(2)).toBe(false);
    expect(isPhotoDay(7)).toBe(false);
  });
});

describe('isDownshift', () => {
  it('only counts training below what was prescribed', () => {
    expect(isDownshift('peak', 'steady')).toBe(true);
    expect(isDownshift('steady', 'peak')).toBe(false);
    expect(isDownshift('steady', 'steady')).toBe(false);
  });
});

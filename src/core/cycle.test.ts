import { describe, it, expect } from 'vitest';
import {
  cycleDayFor,
  estimateCycleLength,
  ovulationDay,
  phaseFor,
  phaseForCycleDay,
  projectedPeriodStarts,
} from './cycle';
import { DEFAULT_PROFILE, type CycleState, type Profile } from './types';

const profile: Profile = { ...DEFAULT_PROFILE, defaultCycleLength: 28, periodLength: 5 };

describe('estimateCycleLength', () => {
  it('falls back to the profile default with fewer than two logged starts', () => {
    expect(estimateCycleLength({ periodStarts: [] }, profile)).toBe(28);
    expect(estimateCycleLength({ periodStarts: ['2026-01-01'] }, profile)).toBe(28);
  });

  it('uses the median of observed intervals', () => {
    // 30, 30, 31 -> median 30
    const cycle: CycleState = {
      periodStarts: ['2026-01-01', '2026-01-31', '2026-03-02', '2026-04-02'],
    };
    expect(estimateCycleLength(cycle, profile)).toBe(30);
  });

  it('ignores implausible gaps rather than letting them drag the average', () => {
    const cycle: CycleState = {
      periodStarts: ['2026-01-01', '2026-01-29', '2026-06-01', '2026-06-29'],
    };
    // The 4-month gap is discarded; the two 28-day gaps stand.
    expect(estimateCycleLength(cycle, profile)).toBe(28);
  });

  it('clamps to a physiologically plausible range', () => {
    const short = estimateCycleLength({ periodStarts: [] }, { ...profile, defaultCycleLength: 5 });
    expect(short).toBe(21);
  });
});

describe('ovulationDay', () => {
  it('counts back from the next period, not forward from the last', () => {
    expect(ovulationDay(28)).toBe(14);
    expect(ovulationDay(35)).toBe(21);
    expect(ovulationDay(24)).toBe(10);
  });
});

describe('phaseForCycleDay', () => {
  const p = (day: number) => phaseForCycleDay(day, 28, 5);

  it('maps a textbook 28-day cycle', () => {
    expect(p(1).phase).toBe('menstrual');
    expect(p(5).phase).toBe('menstrual');
    expect(p(6).phase).toBe('follicular');
    expect(p(12).phase).toBe('follicular');
    expect(p(13).phase).toBe('ovulatory');
    expect(p(14).phase).toBe('ovulatory');
    expect(p(15).phase).toBe('ovulatory');
    expect(p(16).phase).toBe('luteal');
    expect(p(28).phase).toBe('luteal');
  });

  it('flags only the final days before the period as late luteal', () => {
    expect(p(24).isLateLuteal).toBe(false);
    expect(p(25).isLateLuteal).toBe(true);
    expect(p(28).isLateLuteal).toBe(true);
  });

  it('shifts the ovulatory window with cycle length', () => {
    expect(phaseForCycleDay(14, 35, 5).phase).toBe('follicular');
    expect(phaseForCycleDay(21, 35, 5).phase).toBe('ovulatory');
  });
});

describe('cycleDayFor', () => {
  const cycle: CycleState = { periodStarts: ['2026-03-01'] };

  it('returns null before any period is logged', () => {
    expect(cycleDayFor('2026-02-01', cycle, 28)).toBeNull();
  });

  it('counts from the anchor', () => {
    expect(cycleDayFor('2026-03-01', cycle, 28)!.cycleDay).toBe(1);
    expect(cycleDayFor('2026-03-10', cycle, 28)!.cycleDay).toBe(10);
  });

  it('wraps when a period start was not logged', () => {
    const r = cycleDayFor('2026-03-29', cycle, 28)!;
    expect(r.cycleDay).toBe(1);
    expect(r.cyclesProjected).toBe(1);
  });
});

describe('phaseFor', () => {
  it('loses confidence after two unlogged cycles', () => {
    const cycle: CycleState = { periodStarts: ['2026-03-01'] };
    expect(phaseFor('2026-03-10', cycle, profile)!.confident).toBe(true);
    expect(phaseFor('2026-04-10', cycle, profile)!.confident).toBe(true);
    expect(phaseFor('2026-05-10', cycle, profile)!.confident).toBe(false);
  });

  it('reports days remaining until the next expected period', () => {
    const cycle: CycleState = { periodStarts: ['2026-03-01'] };
    expect(phaseFor('2026-03-28', cycle, profile)!.daysToNextPeriod).toBe(1);
  });
});

describe('projectedPeriodStarts', () => {
  it('covers the requested window', () => {
    const cycle: CycleState = { periodStarts: ['2026-03-01'] };
    const starts = projectedPeriodStarts(cycle, profile, '2026-03-01', '2026-05-15');
    expect(starts).toEqual(['2026-03-01', '2026-03-29', '2026-04-26']);
  });

  it('back-projects when the window opens before the anchor', () => {
    const cycle: CycleState = { periodStarts: ['2026-03-01'] };
    const starts = projectedPeriodStarts(cycle, profile, '2026-01-15', '2026-03-05');
    expect(starts).toContain('2026-02-01');
    expect(starts).toContain('2026-03-01');
  });
});

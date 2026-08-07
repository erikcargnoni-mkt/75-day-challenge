import { describe, it, expect } from 'vitest';
import { importJSON } from './storage';
import { SCHEMA_VERSION } from './types';

/**
 * The v1 shape, as it was actually written to localStorage by the first release.
 * Pinned as a literal rather than generated, so a change to the current types
 * can never quietly rewrite what we claim old data looked like.
 */
const V1 = {
  schemaVersion: 1,
  profile: {
    name: 'A',
    weightKg: 60,
    defaultCycleLength: 28,
    periodLength: 5,
    nutritionPlan: 'No alcohol',
    readingPages: 10,
    walkMinutes: 30,
    workoutMinutes: 45,
  },
  cycle: { periodStarts: ['2026-03-01'] },
  current: {
    id: 'a',
    startDate: '2026-03-01',
    outcome: 'active',
    reachedDay: 2,
    days: {
      '2026-03-01': {
        date: '2026-03-01',
        dayIndex: 1,
        workout: { done: true, band: 'restorative', overridden: false },
        walk: true,
        water: 2100,
        nutrition: true,
        reading: true,
        photo: true,
        completedAt: '2026-03-01T20:00:00.000Z',
      },
      '2026-03-02': { date: '2026-03-02', dayIndex: 2, walk: false, water: 0 },
    },
  },
  history: [],
};

describe('v1 → v2 migration', () => {
  const migrated = importJSON(JSON.stringify(V1))!;

  it('reads old saves at all', () => {
    expect(migrated).not.toBeNull();
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('renames walkMinutes to outdoorMinutes', () => {
    expect(migrated.profile.outdoorMinutes).toBe(30);
    expect((migrated.profile as unknown as Record<string, unknown>).walkMinutes).toBeUndefined();
  });

  it('converts a completed walk into an outdoor log', () => {
    expect(migrated.current!.days['2026-03-01'].outdoor).toEqual({ done: true, mode: 'walk' });
  });

  it('leaves an unfinished walk unset rather than inventing one', () => {
    expect(migrated.current!.days['2026-03-02'].outdoor).toBeUndefined();
  });

  it('keeps the sign-off that protects the streak from the new tasks', () => {
    expect(migrated.current!.days['2026-03-01'].completedAt).toBe('2026-03-01T20:00:00.000Z');
  });

  it('does not mutate the object it was handed', () => {
    const raw = structuredClone(V1);
    importJSON(JSON.stringify(raw));
    expect(raw.profile.walkMinutes).toBe(30);
  });

  it('fills in fields that did not exist in v1', () => {
    expect(migrated.profile.readingPages).toBe(10);
    expect(migrated.history).toEqual([]);
  });
});

describe('importJSON', () => {
  it('rejects junk instead of throwing', () => {
    expect(importJSON('not json')).toBeNull();
    expect(importJSON('{}')).toBeNull();
    expect(importJSON('{"profile":{}}')).toBeNull();
  });
});

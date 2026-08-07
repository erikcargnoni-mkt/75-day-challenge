import { initialState } from './challenge';
import { SCHEMA_VERSION, type AppState } from './types';

/**
 * Persistence.
 *
 * Everything stays on the device. Cycle data is special-category health data
 * under GDPR Art. 9, and the only way to guarantee it is never mishandled by a
 * server is to never send it to one. That constraint is deliberate: if this ever
 * becomes a product, local-first is the position, not a limitation to fix.
 *
 * The interface exists so a future native build can swap localStorage for
 * whatever the platform offers without touching a line of the rules engine.
 */

export interface StateStore {
  load(): AppState | null;
  save(state: AppState): void;
  clear(): void;
}

const KEY = 'seventyfive.state.v1';

export const localStore: StateStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      // Quota is the realistic failure here. Photos live in IndexedDB precisely
      // so that a full disk can't take the challenge log down with it.
      console.error('Could not save state', err);
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

/**
 * v1 → v2: the single boolean `walk` became an `outdoor` log carrying walk-or-run,
 * and `profile.walkMinutes` was renamed to match. Days already signed off keep
 * their `completedAt`, which is what stops the newly added tasks (meditation, the
 * now-daily photo) from retroactively invalidating them — see isDayComplete().
 */
function migrateV1toV2(state: Record<string, any>): void {
  const profile = state.profile;
  if (profile && profile.walkMinutes !== undefined) {
    profile.outdoorMinutes = profile.walkMinutes;
    delete profile.walkMinutes;
  }
  const attempts = [state.current, ...(state.history ?? [])].filter(Boolean);
  for (const attempt of attempts) {
    for (const log of Object.values(attempt.days ?? {}) as Record<string, any>[]) {
      if (log.walk !== undefined) {
        if (log.walk === true) log.outdoor = { done: true, mode: 'walk' };
        delete log.walk;
      }
    }
  }
}

function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = structuredClone(raw) as Record<string, any>;
  if (!state.profile || !state.cycle) return null;

  if ((state.schemaVersion ?? 1) < 2) migrateV1toV2(state);

  return {
    ...initialState(),
    ...state,
    profile: { ...initialState().profile, ...state.profile },
    schemaVersion: SCHEMA_VERSION,
  } as AppState;
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text: string): AppState | null {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

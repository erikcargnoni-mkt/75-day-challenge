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

function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Partial<AppState>;
  if (!state.profile || !state.cycle) return null;
  // Only one schema version so far; future versions branch here.
  return {
    ...initialState(),
    ...state,
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

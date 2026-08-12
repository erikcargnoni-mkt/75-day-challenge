import { NO_LOCK, type LockConfig } from '../core/lock';

/**
 * Lock settings live under their own key, deliberately outside AppState.
 *
 * Two reasons. The JSON backup in Settings serialises AppState, and the lock has
 * no business travelling in a file she might email to herself. And importing a
 * backup must not be able to overwrite — or install — a lock on this device.
 */

const KEY = 'seventyfive.lock.v1';

export function loadLock(): LockConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return NO_LOCK;
    return { ...NO_LOCK, ...(JSON.parse(raw) as Partial<LockConfig>) };
  } catch {
    return NO_LOCK;
  }
}

export function saveLock(config: LockConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Could not save lock settings', err);
  }
}

export function clearLock(): void {
  localStorage.removeItem(KEY);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isLockEnabled, type LockConfig } from '../core/lock';
import { loadLock, saveLock } from '../platform/lockStore';

/**
 * Auto-lock grace period.
 *
 * Locking the instant the app loses focus would demand Face ID every time she
 * answers a message mid-workout, and an unlock she resents is an unlock she
 * turns off. A minute is long enough to take a photo in another app and come
 * back, short enough that a phone left on a table re-locks.
 */
const RELOCK_AFTER_MS = 60_000;

interface Ctx {
  config: LockConfig;
  setConfig: (next: LockConfig) => void;
  enabled: boolean;
  unlocked: boolean;
  unlock: () => void;
  lockNow: () => void;
}

const LockCtx = createContext<Ctx | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<LockConfig>(() => loadLock());
  // A configured lock starts locked. Nothing is on screen before it opens.
  const [unlocked, setUnlocked] = useState(() => !isLockEnabled(config));
  const hiddenSince = useRef<number | null>(null);

  const setConfig = useCallback((next: LockConfig) => {
    setConfigState(next);
    saveLock(next);
  }, []);

  const enabled = isLockEnabled(config);

  useEffect(() => {
    // Turning the lock off should not leave the app sitting behind a lock screen.
    if (!enabled) setUnlocked(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince.current = Date.now();
        return;
      }
      const since = hiddenSince.current;
      hiddenSince.current = null;
      if (since !== null && Date.now() - since > RELOCK_AFTER_MS) setUnlocked(false);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  const value = useMemo(
    () => ({
      config,
      setConfig,
      enabled,
      unlocked: !enabled || unlocked,
      unlock: () => setUnlocked(true),
      lockNow: () => setUnlocked(false),
    }),
    [config, setConfig, enabled, unlocked],
  );

  return <LockCtx.Provider value={value}>{children}</LockCtx.Provider>;
}

export function useLock(): Ctx {
  const ctx = useContext(LockCtx);
  if (!ctx) throw new Error('useLock must be used inside LockProvider');
  return ctx;
}

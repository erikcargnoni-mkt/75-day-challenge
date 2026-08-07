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
import { initialState, reconcile } from '../core/challenge';
import { todayISO, type ISODate } from '../core/date';
import { localStore } from '../core/storage';
import type { AppState } from '../core/types';

interface Ctx {
  state: AppState;
  /** Apply a pure state transition from core/challenge and persist it. */
  apply: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
  today: ISODate;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<ISODate>(() => todayISO());
  const [state, setState] = useState<AppState>(() =>
    reconcile(localStore.load() ?? initialState(), todayISO()),
  );

  // Skip the very first save so a fresh install doesn't write a placeholder
  // profile before the user has actually onboarded.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) localStore.save(state);
    loaded.current = true;
  }, [state]);

  /**
   * The day has to be able to roll over while the app sits open overnight —
   * that is exactly when a missed day gets decided. Poll for the date change,
   * and re-check whenever the app comes back to the foreground.
   */
  useEffect(() => {
    const check = () => {
      const now = todayISO();
      setToday((prev) => (prev === now ? prev : now));
      setState((s) => reconcile(s, now));
    };
    const id = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const apply = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const replace = useCallback((s: AppState) => setState(s), []);

  const value = useMemo(() => ({ state, apply, replace, today }), [state, apply, replace, today]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/**
 * Local-calendar date helpers.
 *
 * Everything in this app is keyed on the user's *local* calendar day, never UTC.
 * A challenge day rolls over at local midnight, so using UTC would silently shift
 * the rollover by the timezone offset and could fail a day that was actually done.
 */

export type ISODate = string; // 'YYYY-MM-DD'

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole calendar days from `a` to `b`. Positive when b is later. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of dates from `a` to `b`. */
export function dateRange(a: ISODate, b: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = daysBetween(a, b);
  for (let i = 0; i <= n; i++) out.push(addDays(a, i));
  return out;
}

export function formatLong(s: ISODate): string {
  return fromISO(s).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatShort(s: ISODate): string {
  return fromISO(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

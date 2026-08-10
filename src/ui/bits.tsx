import type { ReactNode } from 'react';
import { PHASE_LABEL } from '../core/cycle';
import type { Phase } from '../core/types';

export const phaseColor = (phase: Phase | null) =>
  phase ? `var(--phase-${phase})` : 'var(--phase-follicular)';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Pill({ children, plain }: { children: ReactNode; plain?: boolean }) {
  return <span className={`pill${plain ? ' plain' : ''}`}>{children}</span>;
}

export function PhasePill({ phase }: { phase: Phase }) {
  return (
    <span className="pill" style={{ '--accent': phaseColor(phase) } as React.CSSProperties}>
      <i className="dot" />
      {PHASE_LABEL[phase]}
    </span>
  );
}

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`check${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      ✓
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Scale({
  value,
  min,
  max,
  labels,
  onChange,
}: {
  value: number | undefined;
  min: number;
  max: number;
  labels?: string[];
  onChange: (n: number) => void;
}) {
  const opts = [];
  for (let i = min; i <= max; i++) opts.push(i);
  return (
    <div className="scale">
      {opts.map((n, idx) => (
        <button
          key={n}
          className={value === n ? 'on' : ''}
          onClick={() => onChange(n)}
          type="button"
        >
          {labels?.[idx] ?? n}
        </button>
      ))}
    </div>
  );
}

/**
 * Reads a decimal from text typed on any keyboard, accepting both `,` and `.`.
 *
 * Returns null for anything that isn't a number *yet* — including the partial
 * states a field passes through while being typed.
 */
export function parseDecimal(text: string): number | null {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '' || normalized === '.') return null;
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Digits plus at most one separator, with up to two decimal places. */
const DECIMAL_DRAFT = /^\d{0,4}([.,]\d{0,2})?$/;

/**
 * A decimal field that survives a comma.
 *
 * `type="number"` cannot be used here: the browser discards any value it judges
 * invalid, and on a phone set to a comma-decimal locale — Spanish, Italian,
 * most of Europe — the key the numeric keypad offers *is* a comma. The field
 * would blank on every keystroke and decimals became impossible to enter.
 * `inputMode="decimal"` still summons the numeric keypad; the parsing is ours.
 */
export function DecimalInput({
  value,
  onChange,
  onEnter,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (text: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => {
        const next = e.target.value;
        // "75," has to be holdable — it is what a half-typed decimal looks like.
        if (next === '' || DECIMAL_DRAFT.test(next)) onChange(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter?.();
      }}
    />
  );
}

export const ml = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}L` : `${n}ml`);
export const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
export const num = (n: number | null, digits = 1) => (n === null ? '—' : n.toFixed(digits));

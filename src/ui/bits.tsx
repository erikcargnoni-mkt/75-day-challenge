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

export const ml = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}L` : `${n}ml`);
export const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
export const num = (n: number | null, digits = 1) => (n === null ? '—' : n.toFixed(digits));

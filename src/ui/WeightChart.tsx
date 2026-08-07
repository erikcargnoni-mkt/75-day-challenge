import { useState } from 'react';
import { PHASE_LABEL } from '../core/cycle';
import { formatShort } from '../core/date';
import type { WeightTrend } from '../core/insights';
import { phaseColor } from './bits';

/**
 * Weight over time.
 *
 * Two series on one scale: the raw morning readings, kept deliberately recessive,
 * and the trailing 7-day average drawn as the primary line. The average is the
 * one that means anything — a single morning moves on salt, sleep and luteal
 * fluid, none of which is the thing she is trying to change.
 *
 * Phase context sits behind everything as background bands, so a luteal bump
 * reads as a phase, not as failure.
 */

const W = 520;
const H = 180;
const PAD = { top: 12, right: 40, bottom: 22, left: 34 };

export function WeightChart({ trend }: { trend: WeightTrend }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = trend.points;

  if (pts.length < 2) return null;

  // Pad the domain so the line never touches the frame, with a 1kg floor so a
  // steady week doesn't get magnified into a dramatic-looking cliff.
  const span = Math.max(trend.max - trend.min, 1);
  const lo = trend.min - span * 0.15;
  const hi = trend.max + span * 0.15;

  const x = (i: number) =>
    PAD.left + (i / (pts.length - 1)) * (W - PAD.left - PAD.right);
  const y = (kg: number) =>
    PAD.top + (1 - (kg - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const line = (get: (i: number) => number | null) => {
    const segs: string[] = [];
    let open = false;
    pts.forEach((_, i) => {
      const v = get(i);
      if (v === null) {
        open = false;
        return;
      }
      segs.push(`${open ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
      open = true;
    });
    return segs.join(' ');
  };

  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const active = hover !== null ? pts[hover] : null;
  const lastAvgIdx = [...pts].reverse().findIndex((p) => p.avg !== null);
  const latestAvg = lastAvgIdx === -1 ? null : pts[pts.length - 1 - lastAvgIdx];

  const onMove = (clientX: number, target: SVGSVGElement) => {
    const box = target.getBoundingClientRect();
    const rel = ((clientX - box.left) / box.width) * W;
    const i = Math.round(
      ((rel - PAD.left) / (W - PAD.left - PAD.right)) * (pts.length - 1),
    );
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Weight from ${formatShort(pts[0].date)} to ${formatShort(
          pts[pts.length - 1].date,
        )}`}
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget)}
        onTouchEnd={() => setHover(null)}
      >
        {/* Phase bands. One rect per run of same-phase days. */}
        {pts.map((p, i) => {
          if (!p.phase) return null;
          const x0 = i === 0 ? PAD.left : (x(i - 1) + x(i)) / 2;
          const x1 = i === pts.length - 1 ? W - PAD.right : (x(i) + x(i + 1)) / 2;
          return (
            <rect
              key={`band-${p.date}`}
              x={x0}
              y={PAD.top}
              width={Math.max(0, x1 - x0)}
              height={H - PAD.top - PAD.bottom}
              fill={phaseColor(p.phase)}
              opacity={0.1}
            />
          );
        })}

        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        <path className="raw-line" d={line((i) => pts[i].kg)} />
        <path className="avg-line" d={line((i) => pts[i].avg)} />

        {latestAvg?.avg != null && (
          <>
            <circle
              className="marker"
              cx={x(pts.length - 1)}
              cy={y(latestAvg.avg)}
              r={4}
              fill="var(--text)"
            />
            <text
              className="latest-label"
              x={x(pts.length - 1) + 8}
              y={y(latestAvg.avg) + 4}
            >
              {latestAvg.avg.toFixed(1)}
            </text>
          </>
        )}

        {active && (
          <>
            <line
              className="crosshair"
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
            <circle
              className="marker"
              cx={x(hover!)}
              cy={y(active.kg)}
              r={5}
              fill={active.phase ? phaseColor(active.phase) : 'var(--muted)'}
            />
          </>
        )}

        <text className="axis-label" x={PAD.left} y={H - 6}>
          {formatShort(pts[0].date)}
        </text>
        <text className="axis-label" x={W - PAD.right} y={H - 6} textAnchor="end">
          {formatShort(pts[pts.length - 1].date)}
        </text>
      </svg>

      {active && (
        <div
          className="chart-tip"
          style={{ left: `${(x(hover!) / W) * 100}%`, top: `${(y(active.kg) / H) * 100 - 4}%` }}
        >
          <strong>{active.kg.toFixed(1)} kg</strong>
          {active.avg !== null && ` · avg ${active.avg.toFixed(1)}`}
          <br />
          <span className="muted">
            {formatShort(active.date)}
            {active.phase ? ` · ${PHASE_LABEL[active.phase]}` : ''}
          </span>
        </div>
      )}

      <div className="legend">
        <span>
          <i className="swatch-line" />
          7-day average
        </span>
        <span>
          <i className="swatch-line raw" />
          Daily reading
        </span>
      </div>
    </div>
  );
}

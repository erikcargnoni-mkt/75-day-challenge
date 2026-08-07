import { useState } from 'react';
import { logPeriodStart, removePeriodStart } from '../core/challenge';
import {
  cycleIntervals,
  estimateCycleLength,
  PHASE_LABEL,
  phaseFor,
  phaseForCycleDay,
} from '../core/cycle';
import { addDays, formatShort, type ISODate } from '../core/date';
import { useApp } from '../state/useApp';
import { Card, Field, phaseColor } from './bits';

export function CycleScreen() {
  const { state, apply, today } = useApp();
  const [pickDate, setPickDate] = useState('');
  const info = phaseFor(today, state.cycle, state.profile);
  const cycleLength = estimateCycleLength(state.cycle, state.profile);
  const intervals = cycleIntervals(state.cycle.periodStarts);

  return (
    <div className="screen">
      <h1>Cycle</h1>
      <p className="muted small">
        Phases are estimated by counting back from your next expected period, because the luteal
        phase is the part of a cycle that stays roughly constant. These are estimates, not
        measurements — and this app does not detect ovulation or track fertility.
      </p>

      <h2>Log</h2>
      <Card>
        <button
          className="btn primary block"
          onClick={() => apply((s) => logPeriodStart(s, today))}
          disabled={state.cycle.periodStarts.includes(today)}
        >
          {state.cycle.periodStarts.includes(today) ? 'Logged for today' : 'My period started today'}
        </button>
        <div style={{ marginTop: 14 }}>
          <Field label="Or log a start date you missed">
            <div className="row">
              <input
                type="date"
                max={today}
                value={pickDate}
                onChange={(e) => setPickDate(e.target.value)}
              />
              <button
                className="btn"
                disabled={!pickDate}
                onClick={() => {
                  apply((s) => logPeriodStart(s, pickDate as ISODate));
                  setPickDate('');
                }}
              >
                Add
              </button>
            </div>
          </Field>
        </div>
      </Card>

      {info ? (
        <>
          <h2>This cycle</h2>
          <Card>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="col">
                <strong>
                  {PHASE_LABEL[info.phase]}
                  {info.isLateLuteal ? ' · late' : ''}
                </strong>
                <span className="small muted">
                  Day {info.cycleDay} of {info.cycleLength}
                </span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <strong className="mono">{info.daysToNextPeriod}</strong>
                <span className="tiny muted">days to next period</span>
              </div>
            </div>

            <CycleStrip cycleLength={cycleLength} currentDay={info.cycleDay} />

            <div className="chips" style={{ marginTop: 12 }}>
              {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map((p) => (
                <span key={p} className="small muted row" style={{ gap: 5 }}>
                  <i
                    className="dot"
                    style={{ background: phaseColor(p), width: 8, height: 8, borderRadius: 4 }}
                  />
                  {PHASE_LABEL[p]}
                </span>
              ))}
            </div>
          </Card>

          <h2>Coming up</h2>
          <Card>
            <Upcoming />
          </Card>
        </>
      ) : (
        <Card>
          <p className="small" style={{ marginBottom: 0 }}>
            No period logged yet, so your daily targets are running neutral. Log one start above and
            the workout intensity and water targets begin tracking your phases.
          </p>
        </Card>
      )}

      <h2>History</h2>
      <Card>
        {state.cycle.periodStarts.length === 0 ? (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Nothing logged yet.
          </p>
        ) : (
          <>
            <p className="small muted">
              Estimated cycle length: <strong className="mono">{cycleLength} days</strong>
              {intervals.length > 0
                ? ` · median of your last ${Math.min(intervals.length, 6)} ${
                    intervals.length === 1 ? 'cycle' : 'cycles'
                  }`
                : ' · your starting guess, not yet measured'}
            </p>
            {[...state.cycle.periodStarts]
              .reverse()
              .map((d, i, arr) => {
                const prev = arr[i + 1];
                const gap = prev
                  ? Math.round(
                      (new Date(d).getTime() - new Date(prev).getTime()) / 86_400_000,
                    )
                  : null;
                return (
                  <div key={d} className="row between" style={{ padding: '8px 0' }}>
                    <span className="small">{formatShort(d)}</span>
                    <span className="row" style={{ gap: 10 }}>
                      {gap !== null && <span className="tiny muted mono">{gap}d cycle</span>}
                      <button
                        className="btn sm ghost"
                        onClick={() => apply((s) => removePeriodStart(s, d))}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                );
              })}
          </>
        )}
      </Card>
    </div>
  );
}

function CycleStrip({ cycleLength, currentDay }: { cycleLength: number; currentDay: number }) {
  const { state } = useApp();
  return (
    <div className="strip">
      {Array.from({ length: cycleLength }, (_, i) => {
        const day = i + 1;
        const p = phaseForCycleDay(day, cycleLength, state.profile.periodLength);
        return (
          <div
            key={day}
            className={`d${day === currentDay ? ' now' : ''}`}
            style={{
              background: `color-mix(in srgb, ${phaseColor(p.phase)} ${
                day === currentDay ? 40 : 16
              }%, var(--surface-2))`,
              borderColor:
                day === currentDay ? 'var(--text)' : `color-mix(in srgb, ${phaseColor(p.phase)} 30%, transparent)`,
            }}
          >
            <div className="dn mono">{day}</div>
            <div className="dl">{PHASE_LABEL[p.phase].slice(0, 3)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** The two dates worth planning around: the next peak window and the next period. */
function Upcoming() {
  const { state, today } = useApp();
  const info = phaseFor(today, state.cycle, state.profile)!;

  let peakStart: ISODate | null = null;
  for (let i = 0; i <= 45; i++) {
    const d = addDays(today, i);
    const p = phaseFor(d, state.cycle, state.profile);
    if (p?.phase === 'ovulatory') {
      peakStart = d;
      break;
    }
  }

  const nextPeriod = addDays(today, info.daysToNextPeriod);

  return (
    <div className="stack">
      <div className="row between">
        <div className="col">
          <span className="title">Next peak window</span>
          <span className="sub">Your strongest training days — plan the hard sessions here.</span>
        </div>
        <span className="pill" style={{ '--accent': phaseColor('ovulatory') } as React.CSSProperties}>
          {peakStart ? formatShort(peakStart) : '—'}
        </span>
      </div>
      <div className="row between">
        <div className="col">
          <span className="title">Next period expected</span>
          <span className="sub">Targets drop to restorative in the four days before it.</span>
        </div>
        <span className="pill" style={{ '--accent': phaseColor('menstrual') } as React.CSSProperties}>
          {formatShort(nextPeriod)}
        </span>
      </div>
    </div>
  );
}

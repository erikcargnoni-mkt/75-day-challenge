import { useState } from 'react';
import { attemptProgress, carryOn, startOver } from '../core/challenge';
import { formatShort } from '../core/date';
import type { TaskId } from '../core/types';
import { useApp } from '../state/useApp';

/**
 * The morning-after prompt.
 *
 * Blocking on purpose: the app will not quietly decide that seventy-five days of
 * work are gone, and it will not quietly pretend the day happened either. She
 * sees exactly what was missed and picks. Carrying is recorded permanently — the
 * copy says so before she chooses, not after.
 */

const TASK_LABEL: Record<TaskId, string> = {
  workout: 'Workout',
  outdoor: 'Outdoors',
  water: 'Water',
  nutrition: 'Nutrition',
  reading: 'Reading',
  meditation: 'Meditation',
  photo: 'Photo',
};

export function MissedDays() {
  const { state, apply, today } = useApp();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const pending = state.pending;
  const attempt = state.current;
  if (!pending || !attempt) return null;

  const progress = attemptProgress(state, attempt, today);
  const n = pending.days.length;
  const alreadyCarried = attempt.carried?.length ?? 0;

  return (
    <div className="overlay">
      <div className="sheet">
        <h1 style={{ marginBottom: 8 }}>
          {n === 1 ? 'A day went unfinished.' : `${n} days went unfinished.`}
        </h1>
        <p className="muted small">
          You have {progress.cleanDays} clean {progress.cleanDays === 1 ? 'day' : 'days'} banked.
          Nothing has been taken away — this is yours to decide.
        </p>

        <div className="missed-list">
          {pending.days.map((d) => (
            <div key={d.date} className="missed-row">
              <div className="row between">
                <strong className="small">Day {d.dayIndex}</strong>
                <span className="tiny muted">{formatShort(d.date)}</span>
              </div>
              <div className="missed-tasks">
                {d.missed.map((t) => (
                  <span key={t} className="chip sm-chip">
                    {TASK_LABEL[t]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {confirmRestart ? (
          <>
            <p className="small" style={{ marginTop: 4 }}>
              This files the current run at day {progress.dayIndex} and starts a new day 1 today.
              Your logs stay in your history. It cannot be undone.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn danger grow"
                onClick={() => apply((s) => startOver(s, today))}
              >
                Start over
              </button>
              <button className="btn ghost grow" onClick={() => setConfirmRestart(false)}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <button className="btn primary grow" onClick={() => apply(carryOn)}>
                Keep going
              </button>
              <button className="btn danger grow" onClick={() => setConfirmRestart(true)}>
                Start over
              </button>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              Keeping going holds your day count and carries {n === 1 ? 'this day' : 'these days'} as
              unfinished. That is permanent: this run can still be finished, but not as a clean 75
              {alreadyCarried > 0 ? `. You have carried ${alreadyCarried} before this` : ''}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

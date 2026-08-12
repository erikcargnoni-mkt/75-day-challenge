import { useEffect, useState } from 'react';
import { attemptProgress, carryOn, clearPending, dayStatus, startOver } from '../core/challenge';
import { formatShort, type ISODate } from '../core/date';
import type { TaskId } from '../core/types';
import { useApp } from '../state/useApp';
import { DayChecklist } from './DayChecklist';

/**
 * The morning-after prompt.
 *
 * Blocking on purpose: the app will not quietly decide that seventy-five days of
 * work are gone, and it will not quietly pretend the day happened either. She
 * sees exactly what was missed and picks.
 *
 * The first version offered only "carry it" or "start over", which left no way
 * to say the most common true thing — *I did it, I just forgot to log it* — and
 * so charged a clean day as a carried one. Filling the log in is now the first
 * option, and the day drops out of the list the moment it is complete.
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
  const [editing, setEditing] = useState<ISODate | null>(null);

  const pending = state.pending;
  const attempt = state.current;

  /*
   * Completeness is read live rather than from `pending`, which is only rebuilt
   * when reconcile runs — up to thirty seconds after she finishes typing. Without
   * this the list would keep showing a day she had just logged.
   */
  const unresolved =
    pending && attempt
      ? pending.days.filter((d) => !dayStatus(state, attempt, d.date).complete)
      : [];

  const resolved = pending !== undefined && unresolved.length === 0;
  useEffect(() => {
    if (resolved) apply(clearPending);
  }, [resolved, apply]);

  if (!pending || !attempt || unresolved.length === 0) return null;

  const progress = attemptProgress(state, attempt, today);
  const n = unresolved.length;
  const alreadyCarried = attempt.carried?.length ?? 0;

  if (editing) {
    const done = dayStatus(state, attempt, editing).complete;
    return (
      <div className="overlay">
        <div className="sheet wide">
          <div className="row between" style={{ marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>{formatShort(editing)}</h1>
            <button className="btn sm ghost" onClick={() => setEditing(null)}>
              Back
            </button>
          </div>
          <p className="muted small">
            {done
              ? 'That day is complete. It no longer counts as missed.'
              : 'Tick what you actually did that day. It stops being a missed day the moment the log is complete.'}
          </p>
          <div className="sheet-scroll">
            <DayChecklist date={editing} />
          </div>
          <button className="btn primary block" onClick={() => setEditing(null)}>
            {done ? 'Done' : 'Back to the list'}
          </button>
        </div>
      </div>
    );
  }

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
          {unresolved.map((d) => (
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
              <button
                className="btn sm block"
                style={{ marginTop: 9 }}
                onClick={() => setEditing(d.date)}
              >
                I did this — log it
              </button>
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
              <button className="btn danger grow" onClick={() => apply((s) => startOver(s, today))}>
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
              Did the work but forgot to log it? Use “I did this — log it” above rather than carrying
              a day you actually earned. Carrying holds your day count but is permanent: the run can
              still be finished, just not as a clean 75
              {alreadyCarried > 0 ? `. You have carried ${alreadyCarried} before this` : ''}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

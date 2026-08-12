import { useState } from 'react';
import {
  BACKFILL_WINDOW_DAYS,
  canEditDay,
  dayStatus,
  setSymptoms,
  setWeight,
  weightOn,
} from '../core/challenge';
import { PHASE_LABEL, phaseFor } from '../core/cycle';
import { addDays, daysBetween, formatLong, type ISODate } from '../core/date';
import { CHALLENGE_LENGTH } from '../core/types';
import { useApp } from '../state/useApp';
import { Card, DecimalInput, parseDecimal, Scale } from './bits';
import { DayChecklist } from './DayChecklist';

export function Today() {
  const { state, today } = useApp();
  const attempt = state.current!;

  /*
   * Which day is on screen. Defaults to today, but she can walk back through the
   * backfill window — the whole point being that a day she did and forgot to log
   * is not a day she missed.
   */
  const [viewDate, setViewDate] = useState<ISODate>(today);
  const isToday = viewDate === today;

  const status = dayStatus(state, attempt, viewDate);
  const info = phaseFor(viewDate, state.cycle, state.profile);
  const { targets } = status;

  const prev = addDays(viewDate, -1);
  const canGoBack = canEditDay(attempt, prev, today);
  const carried = attempt.carried ?? [];

  return (
    <div className="screen">
      <div className="row between top">
        <div>
          <div className="daymark">
            <span className="n mono">{status.dayIndex}</span>
            <span className="of">of {CHALLENGE_LENGTH}</span>
          </div>
          <div className="small muted">{formatLong(viewDate)}</div>
          {carried.length > 0 && isToday && (
            <div className="tiny muted" style={{ marginTop: 4 }}>
              {attempt.reachedDay} clean · {carried.length} carried
            </div>
          )}
        </div>
        {info && (
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <span className="pill">
              <i className="dot" />
              {PHASE_LABEL[info.phase]}
              {info.isLateLuteal ? ' · late' : ''}
            </span>
            <span className="tiny muted mono" style={{ marginTop: 6 }}>
              Cycle day {info.cycleDay}/{info.cycleLength}
            </span>
          </div>
        )}
      </div>

      <ProgressTrack current={status.dayIndex} reached={attempt.reachedDay} />

      <div className="daynav">
        <button
          className="btn sm ghost"
          disabled={!canGoBack}
          onClick={() => setViewDate(prev)}
          aria-label="Previous day"
        >
          ‹ Earlier
        </button>
        <span className="tiny muted">{isToday ? 'Today' : agoLabel(viewDate, today)}</span>
        <button
          className="btn sm ghost"
          disabled={isToday}
          onClick={() => setViewDate(addDays(viewDate, 1))}
          aria-label="Next day"
        >
          Later ›
        </button>
      </div>

      {!isToday && (
        <div className="backfill-banner">
          <strong className="small">Filling in day {status.dayIndex}.</strong>{' '}
          <span className="small">
            Log what you actually did. If this day was carried, completing it clears that.
          </span>
        </div>
      )}

      {isToday && (
        <div className="phase">
          <div className="row between" style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: 14 }}>Today's read</strong>
            {info && !info.confident && <span className="pill plain">Estimate is stale</span>}
          </div>
          <p className="small" style={{ margin: 0 }}>
            {targets.rationale}
          </p>
          {info && !info.confident && (
            <p className="hint" style={{ marginBottom: 0 }}>
              Two or more cycles have passed since you last logged a period. Log one to re-anchor.
            </p>
          )}
        </div>
      )}

      <DayChecklist date={viewDate} />

      <Remaining
        missing={status.missing.length}
        complete={status.complete}
        carried={carried.includes(viewDate)}
        isToday={isToday}
      />

      <WeighIn date={viewDate} />
      <SymptomLog date={viewDate} />

      {isToday && (
        <p className="hint center">
          Forgot to log a day? Tap “Earlier” — you can fill in the last {BACKFILL_WINDOW_DAYS} days.
        </p>
      )}
    </div>
  );
}

function agoLabel(date: ISODate, today: ISODate): string {
  const n = daysBetween(date, today);
  return n === 1 ? 'Yesterday' : `${n} days ago`;
}

function ProgressTrack({ current, reached }: { current: number; reached: number }) {
  return (
    <div className="track" aria-label={`Day ${current} of ${CHALLENGE_LENGTH}`}>
      {Array.from({ length: CHALLENGE_LENGTH }, (_, i) => (
        <i key={i} className={i + 1 <= reached ? 'done' : i + 1 === current ? 'today' : ''} />
      ))}
    </div>
  );
}

function Remaining({
  missing,
  complete,
  carried,
  isToday,
}: {
  missing: number;
  complete: boolean;
  carried: boolean;
  isToday: boolean;
}) {
  if (complete) {
    return (
      <Card>
        <div className="row">
          <span className="pill">Day done</span>
          <span className="small muted grow">
            {isToday ? 'Signed off. Nothing else owed today.' : 'Signed off — this day counts.'}
          </span>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="row between">
        <span className="small">
          <strong>{missing}</strong> {missing === 1 ? 'task' : 'tasks'} left
        </span>
        <span className="tiny muted">
          {carried ? 'Currently carried' : isToday ? 'Resets at midnight' : 'Not yet complete'}
        </span>
      </div>
    </Card>
  );
}

/**
 * Sits outside the checklist on purpose. Weight is measured, not scored —
 * forgetting the scale must not cost the streak.
 */
function WeighIn({ date }: { date: ISODate }) {
  const { state, apply } = useApp();
  const log = state.current!.days[date];
  const logged = log?.weightKg;
  const [draft, setDraft] = useState('');
  const previous = weightOn(state, date);
  const parsed = parseDecimal(draft);
  // A plausible-bodyweight guard, not a judgement — it only catches slips like a
  // missing separator turning 75,4 into 754.
  const valid = parsed !== null && parsed >= 25 && parsed <= 300;

  const save = () => {
    if (!valid) return;
    apply((s) => setWeight(s, date, parsed));
    setDraft('');
  };

  return (
    <Card>
      <div className="row between" style={{ marginBottom: logged ? 0 : 10 }}>
        <div className="col">
          <span className="title">Morning weight</span>
          <span className="sub">
            {logged
              ? `${logged.toFixed(1)} kg logged`
              : 'Optional, and it never affects your streak.'}
          </span>
        </div>
        {logged ? (
          <button
            className="btn sm ghost"
            onClick={() => apply((s) => setWeight(s, date, undefined))}
          >
            Clear
          </button>
        ) : null}
      </div>

      {!logged && (
        <>
          <div className="row" style={{ gap: 8 }}>
            <DecimalInput
              value={draft}
              onChange={setDraft}
              onEnter={save}
              placeholder={previous.toFixed(1)}
              ariaLabel="Weight in kilograms"
            />
            <button className="btn" disabled={!valid} onClick={save}>
              Log
            </button>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            {draft && !valid
              ? 'Enter a weight in kg — 75,4 and 75.4 both work.'
              : 'Same time each morning, before eating. Your water target follows this number.'}
          </p>
        </>
      )}
    </Card>
  );
}

/**
 * Keeps its own text draft so a half-typed "7," survives, and commits upward
 * only once the text parses. Clearing the field clears the stored value.
 */
function SleepInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (hours: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  return (
    <DecimalInput
      value={draft}
      ariaLabel="Hours slept"
      placeholder="7.5"
      onChange={(text) => {
        setDraft(text);
        if (text === '') onChange(undefined);
        else {
          const n = parseDecimal(text);
          if (n !== null && n <= 24) onChange(n);
        }
      }}
    />
  );
}

function SymptomLog({ date }: { date: ISODate }) {
  const { state, apply } = useApp();
  const [open, setOpen] = useState(false);
  const log = state.current!.days[date];
  const s = log?.symptoms ?? {};
  const logged = s.energy || s.mood || s.cramps !== undefined || s.sleepHours;

  if (!open) {
    return (
      <button className="btn ghost block" onClick={() => setOpen(true)}>
        {logged ? 'Edit how the day felt' : 'Log how the day felt (optional)'}
      </button>
    );
  }

  const set = (patch: Parameters<typeof setSymptoms>[2]) => apply((st) => setSymptoms(st, date, patch));

  return (
    <Card>
      <div className="row between" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>How the day felt</strong>
        <button className="btn sm ghost" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
        Optional, and the only reason it exists: after a few cycles this is what tells you whether
        the prescribed intensities actually fit your body.
      </p>

      <div className="stack">
        <div>
          <div className="lbl small muted">Energy</div>
          <Scale value={s.energy} min={1} max={5} onChange={(n) => set({ energy: n as 1 })} />
        </div>
        <div>
          <div className="lbl small muted">Mood</div>
          <Scale value={s.mood} min={1} max={5} onChange={(n) => set({ mood: n as 1 })} />
        </div>
        <div>
          <div className="lbl small muted">Cramps</div>
          <Scale
            value={s.cramps}
            min={0}
            max={3}
            labels={['None', 'Mild', 'Bad', 'Severe']}
            onChange={(n) => set({ cramps: n as 0 })}
          />
        </div>
        <div>
          <div className="lbl small muted">Sleep (hours)</div>
          <SleepInput value={s.sleepHours} onChange={(hours) => set({ sleepHours: hours })} />
        </div>
        <div>
          <div className="lbl small muted">Note</div>
          <textarea
            value={s.note ?? ''}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Anything worth remembering about this day."
          />
        </div>
      </div>
    </Card>
  );
}

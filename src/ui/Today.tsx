import { useEffect, useRef, useState } from 'react';
import {
  addWater,
  clearMeditation,
  clearOutdoor,
  clearWorkout,
  completeWorkout,
  dayStatus,
  setMeditation,
  setOutdoor,
  setSymptoms,
  setWeight,
  toggleBoolTask,
  weightOn,
} from '../core/challenge';
import { PHASE_LABEL, phaseFor } from '../core/cycle';
import { formatLong, type ISODate } from '../core/date';
import { deletePhoto, getPhoto, savePhoto } from '../core/photos';
import { BAND_LABEL, isDownshift } from '../core/targets';
import {
  BAND_ORDER,
  CHALLENGE_LENGTH,
  DEFAULT_MEDITATION,
  MEDITATION_OPTIONS,
  type IntensityBand,
  type MeditationMinutes,
  type OutdoorMode,
} from '../core/types';
import { useApp } from '../state/useApp';
import { Card, Check, ml, Scale } from './bits';

export function Today() {
  const { state, apply, today } = useApp();
  const attempt = state.current!;
  const status = dayStatus(state, attempt, today);
  const info = phaseFor(today, state.cycle, state.profile);
  const { targets, log } = status;

  const dayIndex = status.dayIndex;
  const water = log.water ?? 0;
  const waterPct = Math.min(1, water / targets.waterMl);

  return (
    <div className="screen">
      <div className="row between top">
        <div>
          <div className="daymark">
            <span className="n mono">{dayIndex}</span>
            <span className="of">of {CHALLENGE_LENGTH}</span>
          </div>
          <div className="small muted">{formatLong(today)}</div>
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

      <ProgressTrack current={dayIndex} reached={attempt.reachedDay} />

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

      <Card className="flush">
        <WorkoutTask />

        <OutdoorTask />

        <div className="task">
          <Check
            on={waterPct >= 1}
            label="Water"
            onClick={() =>
              apply((s) =>
                waterPct >= 1 ? addWater(s, today, -water) : addWater(s, today, targets.waterMl - water),
              )
            }
          />
          <div className="grow">
            <div className="row between">
              <span className="title">Water</span>
              <span className="small mono muted">
                {ml(water)} / {ml(targets.waterMl)}
              </span>
            </div>
            <div className="water-bar">
              <div className="water-fill" style={{ width: `${waterPct * 100}%` }} />
            </div>
            <div className="chips">
              {[250, 500, 750].map((n) => (
                <button key={n} className="chip" onClick={() => apply((s) => addWater(s, today, n))}>
                  +{n}
                </button>
              ))}
              {water > 0 && (
                <button className="chip" onClick={() => apply((s) => addWater(s, today, -250))}>
                  −250
                </button>
              )}
            </div>
          </div>
        </div>

        <BoolTask
          done={log.nutrition === true}
          title="Nutrition held"
          sub={targets.nutritionPlan || 'No plan set — add one in Settings.'}
          onToggle={() => apply((s) => toggleBoolTask(s, today, 'nutrition'))}
        />

        <BoolTask
          done={log.reading === true}
          title={`${targets.readingPages} pages of non-fiction`}
          sub="Paper or e-reader. Audiobooks do not count."
          onToggle={() => apply((s) => toggleBoolTask(s, today, 'reading'))}
        />

        <MeditationTask />

        <PhotoTask date={today} done={log.photo === true} />
      </Card>

      <Remaining missing={status.missing.length} complete={status.complete} />

      <WeighIn date={today} />

      <SymptomLog date={today} />
    </div>
  );
}

function ProgressTrack({ current, reached }: { current: number; reached: number }) {
  return (
    <div className="track" aria-label={`Day ${current} of ${CHALLENGE_LENGTH}`}>
      {Array.from({ length: CHALLENGE_LENGTH }, (_, i) => (
        <i
          key={i}
          className={i + 1 <= reached ? 'done' : i + 1 === current ? 'today' : ''}
        />
      ))}
    </div>
  );
}

function BoolTask({
  done,
  title,
  sub,
  onToggle,
}: {
  done: boolean;
  title: string;
  sub: string;
  onToggle: () => void;
}) {
  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check on={done} onClick={onToggle} label={title} />
      <div className="grow col">
        <span className="title">{title}</span>
        <span className="sub">{sub}</span>
      </div>
    </div>
  );
}

/**
 * The one place the challenge flexes. She picks the band she actually trained.
 * Anything below the prescription is recorded as a downshift and still completes
 * the day — the streak survives, and the log stays honest about what happened.
 */
function WorkoutTask() {
  const { state, apply, today } = useApp();
  const status = dayStatus(state, state.current!, today);
  const { targets, log } = status;
  const done = log.workout?.done === true;
  const prescribed = targets.workout.band;

  const pick = (band: IntensityBand) => {
    apply((s) =>
      done && log.workout?.band === band ? clearWorkout(s, today) : completeWorkout(s, today, band),
    );
  };

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check
        on={done}
        label="Workout"
        onClick={() => apply((s) => (done ? clearWorkout(s, today) : completeWorkout(s, today, prescribed)))}
      />
      <div className="grow">
        <div className="row between">
          <span className="title">{targets.workout.headline}</span>
        </div>
        <div className="sub">{targets.workout.guidance}</div>

        <div className="chips">
          {BAND_ORDER.map((band) => {
            const active = done && log.workout?.band === band;
            return (
              <button
                key={band}
                className={`chip${active ? ' on' : band === prescribed ? ' prescribed' : ''}`}
                onClick={() => pick(band)}
              >
                {BAND_LABEL[band]}
                {band === prescribed && !active ? ' ·' : ''}
              </button>
            );
          })}
        </div>

        {done && log.workout && isDownshift(prescribed, log.workout.band) && (
          <div className="hint">
            Logged below today's prescription. That is allowed and your streak is intact — but it is
            recorded, and if it becomes the pattern the app will tell you.
          </div>
        )}

        {targets.workout.caution && !done && <div className="caution">{targets.workout.caution}</div>}
      </div>
    </div>
  );
}

const OUTDOOR_LABEL: Record<OutdoorMode, string> = { walk: 'Walk', run: 'Run' };

/** Same shape as the workout: tick it, or pick how you did it and it ticks itself. */
function OutdoorTask() {
  const { state, apply, today } = useApp();
  const { targets, log } = dayStatus(state, state.current!, today);
  const done = log.outdoor?.done === true;

  const pick = (mode: OutdoorMode) =>
    apply((s) =>
      done && log.outdoor?.mode === mode ? clearOutdoor(s, today) : setOutdoor(s, today, mode),
    );

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check
        on={done}
        label="Outdoor time"
        onClick={() => apply((s) => (done ? clearOutdoor(s, today) : setOutdoor(s, today, 'walk')))}
      />
      <div className="grow">
        <div className="title">{targets.outdoorMinutes} min outdoors</div>
        <div className="sub">Outside, whatever the weather. This one never scales.</div>
        <div className="chips">
          {(['walk', 'run'] as OutdoorMode[]).map((mode) => (
            <button
              key={mode}
              className={`chip${done && log.outdoor?.mode === mode ? ' on' : ''}`}
              onClick={() => pick(mode)}
            >
              {OUTDOOR_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeditationTask() {
  const { state, apply, today } = useApp();
  const { log } = dayStatus(state, state.current!, today);
  const done = log.meditation?.done === true;

  const pick = (minutes: MeditationMinutes) =>
    apply((s) =>
      done && log.meditation?.minutes === minutes
        ? clearMeditation(s, today)
        : setMeditation(s, today, minutes),
    );

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check
        on={done}
        label="Meditation"
        onClick={() =>
          apply((s) =>
            done ? clearMeditation(s, today) : setMeditation(s, today, DEFAULT_MEDITATION),
          )
        }
      />
      <div className="grow">
        <div className="title">
          Meditation{done && log.meditation ? ` · ${log.meditation.minutes} min` : ''}
        </div>
        <div className="sub">Sitting, breath, eyes closed. Any length on the list counts.</div>
        <div className="chips">
          {MEDITATION_OPTIONS.map((m) => (
            <button
              key={m}
              className={`chip${done && log.meditation?.minutes === m ? ' on' : ''}`}
              onClick={() => pick(m)}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
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

  const save = () => {
    const kg = Number(draft.replace(',', '.'));
    if (kg > 0) apply((s) => setWeight(s, date, kg));
    setDraft('');
  };

  return (
    <Card>
      <div className="row between" style={{ marginBottom: logged ? 0 : 10 }}>
        <div className="col">
          <span className="title">Morning weight</span>
          <span className="sub">
            {logged
              ? `${logged.toFixed(1)} kg logged today`
              : 'Optional, and it never affects your streak.'}
          </span>
        </div>
        {logged ? (
          <button className="btn sm ghost" onClick={() => apply((s) => setWeight(s, date, undefined))}>
            Clear
          </button>
        ) : null}
      </div>

      {!logged && (
        <>
          <div className="row" style={{ gap: 8 }}>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={previous.toFixed(1)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button className="btn" disabled={!draft} onClick={save}>
              Log
            </button>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Same time each morning, before eating. Your water target follows this number.
          </p>
        </>
      )}
    </Card>
  );
}

function PhotoTask({ date, done }: { date: ISODate; done: boolean }) {
  const { apply } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    getPhoto(date).then((blob) => {
      if (blob) {
        revoked = URL.createObjectURL(blob);
        setUrl(revoked);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [date]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await savePhoto(date, file);
      const blob = await getPhoto(date);
      if (blob) setUrl(URL.createObjectURL(blob));
      apply((s) => (s.current?.days[date]?.photo ? s : toggleBoolTask(s, date, 'photo')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await deletePhoto(date);
    setUrl(null);
    apply((s) => (s.current?.days[date]?.photo ? toggleBoolTask(s, date, 'photo') : s));
  };

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check on={done} label="Progress photo" onClick={() => (url ? remove() : inputRef.current?.click())} />
      <div className="grow">
        <div className="title">Progress photo</div>
        <div className="sub">Same light, same spot, same time of day. Stays on this device.</div>
        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {url ? (
          <div style={{ marginTop: 10 }}>
            <img className="photo" src={url} alt="Progress photo" />
            <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={remove}>
              Remove
            </button>
          </div>
        ) : (
          <div className="chips">
            <button className="chip" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? 'Saving…' : 'Take photo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Remaining({ missing, complete }: { missing: number; complete: boolean }) {
  if (complete) {
    return (
      <Card>
        <div className="row">
          <span className="pill">Day done</span>
          <span className="small muted grow">Signed off. Nothing else owed today.</span>
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
        <span className="tiny muted">Resets at midnight</span>
      </div>
    </Card>
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
        {logged ? 'Edit how today felt' : 'Log how today felt (optional)'}
      </button>
    );
  }

  const set = (patch: Parameters<typeof setSymptoms>[2]) => apply((st) => setSymptoms(st, date, patch));

  return (
    <Card>
      <div className="row between" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>How today felt</strong>
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
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={s.sleepHours ?? ''}
            onChange={(e) => set({ sleepHours: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </div>
        <div>
          <div className="lbl small muted">Note</div>
          <textarea
            value={s.note ?? ''}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Anything worth remembering about today."
          />
        </div>
      </div>
    </Card>
  );
}

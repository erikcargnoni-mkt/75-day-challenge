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
  toggleBoolTask,
} from '../core/challenge';
import type { ISODate } from '../core/date';
import { deletePhoto, getPhoto, savePhoto } from '../core/photos';
import { BAND_LABEL, isDownshift } from '../core/targets';
import {
  BAND_ORDER,
  DEFAULT_MEDITATION,
  MEDITATION_OPTIONS,
  type IntensityBand,
  type MeditationMinutes,
  type OutdoorMode,
} from '../core/types';
import { readingStats } from '../core/insights';
import { useApp } from '../state/useApp';
import { Card, Check, ml } from './bits';

/**
 * The daily tasks for any date: seven required, plus reading, which is not.
 *
 * Every task takes the date as a prop rather than reaching for "today", which is
 * what lets a forgotten evening be filled in the next morning. The core has
 * always permitted editing a past day; only the screen assumed otherwise.
 */
export function DayChecklist({ date }: { date: ISODate }) {
  const { state, apply } = useApp();
  const { targets, log } = dayStatus(state, state.current!, date);
  const water = log.water ?? 0;
  const waterPct = Math.min(1, water / targets.waterMl);

  return (
    <Card className="flush">
      <WorkoutTask date={date} />
      <OutdoorTask date={date} />

      <div className="task">
        <Check
          on={waterPct >= 1}
          label="Water"
          onClick={() =>
            apply((s) =>
              waterPct >= 1
                ? addWater(s, date, -water)
                : addWater(s, date, targets.waterMl - water),
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
              <button key={n} className="chip" onClick={() => apply((s) => addWater(s, date, n))}>
                +{n}
              </button>
            ))}
            {water > 0 && (
              <button className="chip" onClick={() => apply((s) => addWater(s, date, -250))}>
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
        onToggle={() => apply((s) => toggleBoolTask(s, date, 'nutrition'))}
      />

      <BoolTask
        done={log.coldShower === true}
        title="Cold shower"
        sub="End cold and stay there. Long enough that it stops being a dare and starts being a habit."
        onToggle={() => apply((s) => toggleBoolTask(s, date, 'coldShower'))}
      />

      <MeditationTask date={date} />
      <PhotoTask date={date} done={log.photo === true} />
      <ReadingTask date={date} />
    </Card>
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
 * Reading, the one optional pillar.
 *
 * It cannot cost her the day, so the only thing that can keep it happening is
 * making the doing of it visibly worth something. The streak is the whole
 * reward, and it is shown at the moment she ticks the box rather than buried on
 * another screen.
 */
function ReadingTask({ date }: { date: ISODate }) {
  const { state, apply, today } = useApp();
  const { targets, log } = dayStatus(state, state.current!, date);
  const done = log.reading === true;
  const stats = readingStats(state, today);

  return (
    <div className={`task optional${done ? ' done' : ''}`}>
      <Check
        on={done}
        onClick={() => apply((s) => toggleBoolTask(s, date, 'reading'))}
        label="Reading"
      />
      <div className="grow">
        <div className="row between">
          <span className="title">{targets.readingPages} pages of non-fiction</span>
          <span className="pill plain">Optional</span>
        </div>
        <div className="sub">
          {done
            ? 'Paper or e-reader. Audiobooks do not count.'
            : 'Skipping this never costs you the day.'}
        </div>

        {stats.currentStreak > 0 && (
          <div className="streak">
            <strong className="mono">{stats.currentStreak}</strong>
            <span>
              {stats.currentStreak === 1 ? 'day running' : 'days running'}
              {stats.longestStreak > stats.currentStreak
                ? ` · best ${stats.longestStreak}`
                : stats.currentStreak >= 3 && stats.currentStreak === stats.longestStreak
                  ? ' · your best yet'
                  : ''}
            </span>
            <span className="grow" />
            <span className="tiny muted mono">~{stats.pages} pages</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The one place the challenge flexes. She picks the band she actually trained.
 * Anything below the prescription is recorded as a downshift and still completes
 * the day — the streak survives, and the log stays honest about what happened.
 */
function WorkoutTask({ date }: { date: ISODate }) {
  const { state, apply } = useApp();
  const { targets, log } = dayStatus(state, state.current!, date);
  const done = log.workout?.done === true;
  const prescribed = targets.workout.band;

  const pick = (band: IntensityBand) =>
    apply((s) =>
      done && log.workout?.band === band ? clearWorkout(s, date) : completeWorkout(s, date, band),
    );

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check
        on={done}
        label="Workout"
        onClick={() =>
          apply((s) => (done ? clearWorkout(s, date) : completeWorkout(s, date, prescribed)))
        }
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
            Logged below this day's prescription. That is allowed and your streak is intact — but it
            is recorded, and if it becomes the pattern the app will tell you.
          </div>
        )}

        {targets.workout.caution && !done && <div className="caution">{targets.workout.caution}</div>}
      </div>
    </div>
  );
}

const OUTDOOR_LABEL: Record<OutdoorMode, string> = { walk: 'Walk', run: 'Run' };

/** Same shape as the workout: tick it, or pick how you did it and it ticks itself. */
function OutdoorTask({ date }: { date: ISODate }) {
  const { state, apply } = useApp();
  const { targets, log } = dayStatus(state, state.current!, date);
  const done = log.outdoor?.done === true;

  const pick = (mode: OutdoorMode) =>
    apply((s) =>
      done && log.outdoor?.mode === mode ? clearOutdoor(s, date) : setOutdoor(s, date, mode),
    );

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check
        on={done}
        label="Outdoor time"
        onClick={() => apply((s) => (done ? clearOutdoor(s, date) : setOutdoor(s, date, 'walk')))}
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

function MeditationTask({ date }: { date: ISODate }) {
  const { state, apply } = useApp();
  const { log } = dayStatus(state, state.current!, date);
  const done = log.meditation?.done === true;

  const pick = (minutes: MeditationMinutes) =>
    apply((s) =>
      done && log.meditation?.minutes === minutes
        ? clearMeditation(s, date)
        : setMeditation(s, date, minutes),
    );

  return (
    <div className={`task${done ? ' done' : ''}`}>
      <Check
        on={done}
        label="Meditation"
        onClick={() =>
          apply((s) =>
            done ? clearMeditation(s, date) : setMeditation(s, date, DEFAULT_MEDITATION),
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

function PhotoTask({ date, done }: { date: ISODate; done: boolean }) {
  const { apply } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    getPhoto(date).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
      <Check
        on={done}
        label="Progress photo"
        onClick={() => (url ? remove() : inputRef.current?.click())}
      />
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
              {busy ? 'Saving…' : 'Add photo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { dayStatus, dateForDayIndex, isCleanRun } from '../core/challenge';
import { PHASE_LABEL, phaseFor } from '../core/cycle';
import { formatShort, type ISODate } from '../core/date';
import { bandFitMessage, overview, phaseStats, weightTrend } from '../core/insights';
import { getPhoto, listPhotoDates } from '../core/photos';
import { CHALLENGE_LENGTH } from '../core/types';
import { useApp } from '../state/useApp';
import { Card, num, pct, phaseColor } from './bits';
import { WeightChart } from './WeightChart';

export function Progress() {
  const { state, today } = useApp();
  const attempt = state.current;
  const all = attempt ? [...state.history, attempt] : state.history;
  const stats = phaseStats(state, all);
  const ov = overview(state);
  const fit = bandFitMessage(stats);

  return (
    <div className="screen">
      <h1>Progress</h1>

      <Card>
        <div className="row between">
          <Stat label="Best day reached" value={ov.bestDay} />
          <Stat label="Attempts" value={ov.attemptsMade} />
          <Stat label="Days signed off" value={ov.totalDaysLogged} />
          <Stat label="Days carried" value={ov.carried} />
        </div>
      </Card>

      {attempt && (
        <>
          <h2>This attempt</h2>
          <Card>
            <DayGrid />
            <p className="hint" style={{ marginBottom: 0 }}>
              Filled squares are days you closed out; colour is the cycle phase you were in. Dashed
              red squares are days you carried — they stay visible for the whole run.
            </p>
          </Card>
        </>
      )}

      <h2>Weight</h2>
      <WeightSection />

      <h2>By phase</h2>
      <Card>
        {ov.totalDaysLogged === 0 ? (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Nothing to compare yet. This table gets interesting around the end of your first cycle.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Days</th>
                  <th>Done</th>
                  <th>Downshift</th>
                  <th>Energy</th>
                  <th>Weight</th>
                  <th>Water</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.phase}>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <i
                          className="dot"
                          style={{ background: phaseColor(s.phase), width: 8, height: 8 }}
                        />
                        {PHASE_LABEL[s.phase]}
                      </span>
                    </td>
                    <td className="mono">{s.days}</td>
                    <td className="mono">{s.days ? `${s.completeDays}/${s.days}` : '—'}</td>
                    <td className="mono">{pct(s.downshiftRate)}</td>
                    <td className="mono">{num(s.avgEnergy)}</td>
                    <td className="mono">{s.avgWeight === null ? '—' : `${s.avgWeight.toFixed(1)}`}</td>
                    <td className="mono">{pct(s.waterAdherence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {fit && (
        <Card>
          <div className="tiny muted" style={{ marginBottom: 6 }}>
            What the data says
          </div>
          <p className="small" style={{ marginBottom: 0 }}>
            {fit}
          </p>
        </Card>
      )}

      <h2>Photos</h2>
      <PhotoWall />

      {state.history.length > 0 && (
        <>
          <h2>Past attempts</h2>
          <Card>
            {[...state.history].reverse().map((a) => (
              <div key={a.id} className="row between" style={{ padding: '8px 0' }}>
                <span className="small">
                  {formatShort(a.startDate)}
                  {a.failedOn ? ` → ${formatShort(a.failedOn)}` : ''}
                </span>
                <span className="row" style={{ gap: 10 }}>
                  <span className="tiny muted mono">
                    {a.reachedDay} clean
                    {(a.carried?.length ?? 0) > 0 ? ` · ${a.carried!.length} carried` : ''}
                  </span>
                  <span className={`pill${isCleanRun(a) ? '' : ' plain'}`}>
                    {a.outcome === 'completed'
                      ? isCleanRun(a)
                        ? 'Clean 75'
                        : 'Finished'
                      : 'Restarted'}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        </>
      )}

      <p className="hint">
        Today is {formatShort(today)}.
      </p>
    </div>
  );
}

function WeightSection() {
  const { state } = useApp();
  const trend = weightTrend(state);

  if (trend.points.length < 2) {
    return (
      <Card>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Log your weight on the Today screen for a couple of days and the trend appears here.
        </p>
      </Card>
    );
  }

  const enoughForAverage = trend.change !== null;

  return (
    <Card>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="col">
          <span className="mono" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
            {trend.latest?.toFixed(1)} kg
          </span>
          <span className="tiny muted">Latest reading</span>
        </div>
        <div className="col" style={{ alignItems: 'flex-end' }}>
          <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
            {enoughForAverage
              ? `${trend.change! >= 0 ? '+' : ''}${trend.change!.toFixed(1)} kg`
              : '—'}
          </span>
          <span className="tiny muted">
            {enoughForAverage ? 'Change on the average' : 'Needs 7 days'}
          </span>
        </div>
      </div>

      <WeightChart trend={trend} />

      <p className="hint" style={{ marginBottom: 0 }}>
        The bold line is the 7-day average — that is the one to read. Single mornings move on salt,
        sleep and fluid, and the shaded bands show which phase each reading fell in: a rise across the
        luteal band is usually water, not fat.
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="col center" style={{ flex: 1, alignItems: 'center' }}>
      <span className="mono" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </span>
      <span className="tiny muted" style={{ textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

function DayGrid() {
  const { state, today } = useApp();
  const attempt = state.current!;

  return (
    <div className="grid75">
      {Array.from({ length: CHALLENGE_LENGTH }, (_, i) => {
        const dayIndex = i + 1;
        const date = dateForDayIndex(attempt, dayIndex);
        const complete = dayStatus(state, attempt, date).complete;
        const carried = attempt.carried?.includes(date) ?? false;
        const info = phaseFor(date, state.cycle, state.profile);
        const color = info ? phaseColor(info.phase) : 'var(--muted)';
        return (
          <span
            key={dayIndex}
            className={`${complete ? 'complete' : ''}${carried ? ' carried' : ''}${
              date === today ? ' today' : ''
            }`}
            title={`Day ${dayIndex} · ${formatShort(date)}${carried ? ' · carried' : ''}`}
            style={
              complete
                ? { background: color }
                : { background: `color-mix(in srgb, ${color} 10%, var(--surface-2))` }
            }
          />
        );
      })}
    </div>
  );
}

function PhotoWall() {
  const [items, setItems] = useState<{ date: ISODate; url: string }[]>([]);

  useEffect(() => {
    let urls: string[] = [];
    listPhotoDates().then(async (dates) => {
      const out: { date: ISODate; url: string }[] = [];
      for (const d of dates) {
        const blob = await getPhoto(d);
        if (blob) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          out.push({ date: d, url });
        }
      }
      setItems(out);
    });
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  if (items.length === 0) {
    return (
      <Card>
        <p className="small muted" style={{ marginBottom: 0 }}>
          No photos yet. The first one is due on day 1, then every seventh day.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="photos">
        {items.map((it) => (
          <figure key={it.date} style={{ margin: 0 }}>
            <img className="photo" src={it.url} alt={`Progress photo ${it.date}`} />
            <figcaption className="tiny muted center" style={{ marginTop: 4 }}>
              {formatShort(it.date)}
            </figcaption>
          </figure>
        ))}
      </div>
    </Card>
  );
}

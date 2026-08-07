import { useEffect, useState } from 'react';
import { dayStatus, dateForDayIndex } from '../core/challenge';
import { PHASE_LABEL, phaseFor } from '../core/cycle';
import { formatShort, type ISODate } from '../core/date';
import { bandFitMessage, overview, phaseStats } from '../core/insights';
import { getPhoto, listPhotoDates } from '../core/photos';
import { CHALLENGE_LENGTH } from '../core/types';
import { useApp } from '../state/useApp';
import { Card, num, pct, phaseColor } from './bits';

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
        </div>
      </Card>

      {attempt && (
        <>
          <h2>This attempt</h2>
          <Card>
            <DayGrid />
            <p className="hint" style={{ marginBottom: 0 }}>
              Filled squares are days you closed out. Colour is the cycle phase you were in.
            </p>
          </Card>
        </>
      )}

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
                  <span className="tiny muted mono">day {a.reachedDay}</span>
                  <span className={`pill${a.outcome === 'completed' ? '' : ' plain'}`}>
                    {a.outcome === 'completed' ? 'Finished' : 'Reset'}
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
        const info = phaseFor(date, state.cycle, state.profile);
        const color = info ? phaseColor(info.phase) : 'var(--muted)';
        return (
          <span
            key={dayIndex}
            className={`${complete ? 'complete' : ''}${date === today ? ' today' : ''}`}
            title={`Day ${dayIndex} · ${formatShort(date)}`}
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

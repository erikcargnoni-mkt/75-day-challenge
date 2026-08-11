import { useState } from 'react';
import { dismissNotice, startChallenge } from './core/challenge';
import { phaseFor } from './core/cycle';
import { formatShort } from './core/date';
import { AppProvider, useApp } from './state/useApp';
import { Card, phaseColor } from './ui/bits';
import { CycleScreen } from './ui/Cycle';
import { MissedDays } from './ui/MissedDays';
import { Onboarding } from './ui/Onboarding';
import { Progress } from './ui/Progress';
import { Settings } from './ui/Settings';
import { Today } from './ui/Today';

type Tab = 'today' | 'cycle' | 'progress' | 'settings';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { state, today } = useApp();
  const [tab, setTab] = useState<Tab>('today');

  const info = phaseFor(today, state.cycle, state.profile);
  const onboarded = state.profile.nutritionPlan.length > 0 || state.history.length > 0;

  // The accent drives every highlight in the app, so the whole shell shifts
  // colour with the phase she is actually in.
  const style = { '--accent': phaseColor(info?.phase ?? null) } as React.CSSProperties;

  if (!onboarded && !state.current) {
    return (
      <div className="app" style={style}>
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="app" style={style}>
      {/* Blocks everything until she decides — see MissedDays. */}
      <MissedDays />
      <NoticeSheet />
      {tab === 'today' && (state.current ? <Today /> : <BetweenAttempts />)}
      {tab === 'cycle' && <CycleScreen />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <Settings />}

      <nav className="nav">
        <TabButton tab="today" label="Today" glyph="◉" active={tab} onPick={setTab} />
        <TabButton tab="cycle" label="Cycle" glyph="◐" active={tab} onPick={setTab} />
        <TabButton tab="progress" label="Progress" glyph="▤" active={tab} onPick={setTab} />
        <TabButton tab="settings" label="Settings" glyph="⚙" active={tab} onPick={setTab} />
      </nav>
    </div>
  );
}

function TabButton({
  tab,
  label,
  glyph,
  active,
  onPick,
}: {
  tab: Tab;
  label: string;
  glyph: string;
  active: Tab;
  onPick: (t: Tab) => void;
}) {
  return (
    <button className={active === tab ? 'active' : ''} onClick={() => onPick(tab)}>
      <span className="glyph">{glyph}</span>
      {label}
    </button>
  );
}

/**
 * Shown after a reset or a finish. The tone matters here: this is the screen
 * she sees on the worst morning of the challenge, and it should be honest
 * without being punishing.
 */
function BetweenAttempts() {
  const { state, apply, today } = useApp();
  const last = state.history[state.history.length - 1];
  const finished = last?.outcome === 'completed';
  const carried = last?.carried?.length ?? 0;

  return (
    <div className="screen">
      <h1>{finished ? '75 done.' : 'Day 1 again.'}</h1>
      {last && (
        <p className="muted">
          {finished
            ? carried === 0
              ? `Started ${formatShort(last.startDate)}. Seventy-five days, no gaps.`
              : `Started ${formatShort(last.startDate)}. ${last.reachedDay} clean days, ${carried} carried.`
            : `Your last attempt reached day ${last.reachedDay}. That work happened — it is in your history and it counted for your body, whatever the counter says.`}
        </p>
      )}

      <Card>
        <p className="small" style={{ marginBottom: 14 }}>
          {finished
            ? 'Run it again if you want it. The cycle data you have built up makes the second round fit you better than the first.'
            : 'The rules do not change and the reset is not a verdict. Start when you are ready to hold all of it — not before.'}
        </p>
        <button className="btn primary block" onClick={() => apply((s) => startChallenge(s, today))}>
          Start a new 75 today
        </button>
      </Card>
    </div>
  );
}

function NoticeSheet() {
  const { state, apply } = useApp();
  const notice = state.notice;
  if (!notice) return null;

  const finished = state.history[state.history.length - 1];
  const carried = finished?.carried?.length ?? 0;
  const close = () => apply(dismissNotice);

  return (
    <div className="overlay" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h1>You finished.</h1>
        {carried === 0 ? (
          <p className="muted">
            Seventy-five days, every task, no gaps. A clean run. Put the photo from day 1 next to
            today's.
          </p>
        ) : (
          <p className="muted">
            Seventy-five days, {notice.reachedDay} of them clean, {carried} carried. You did not
            quit — and the record says exactly what happened, which is what makes the {notice.reachedDay}{' '}
            mean something. Put the photo from day 1 next to today's.
          </p>
        )}
        <button className="btn primary block" onClick={close}>
          Got it
        </button>
      </div>
    </div>
  );
}

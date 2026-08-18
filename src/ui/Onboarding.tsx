import { useState } from 'react';
import { logPeriodStart, startChallenge, updateProfile } from '../core/challenge';
import { todayISO } from '../core/date';
import { useApp } from '../state/useApp';
import { Card, DecimalInput, Field, parseDecimal } from './bits';

/**
 * Setup. Deliberately short — five answers and she is on day 1. Everything
 * else the app learns from her logging.
 */
export function Onboarding() {
  const { state, apply, today } = useApp();
  const [name, setName] = useState(state.profile.name);
  const [weight, setWeight] = useState(String(state.profile.weightKg));
  const [cycleLength, setCycleLength] = useState(String(state.profile.defaultCycleLength));
  const [periodLength, setPeriodLength] = useState(String(state.profile.periodLength));
  const [plan, setPlan] = useState(state.profile.nutritionPlan);
  const [lastPeriod, setLastPeriod] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(today);

  const parsedWeight = parseDecimal(weight);
  const ready = plan.trim().length > 0 && parsedWeight !== null && parsedWeight >= 25;

  const begin = () => {
    apply((s) => {
      let next = updateProfile(s, {
        name: name.trim(),
        weightKg: parsedWeight ?? s.profile.weightKg,
        defaultCycleLength: Number(cycleLength),
        periodLength: Number(periodLength),
        nutritionPlan: plan.trim(),
      });
      if (lastPeriod) next = logPeriodStart(next, lastPeriod);
      return startChallenge(next, startDate || todayISO());
    });
  };

  return (
    <div className="screen">
      <h1>75 days.</h1>
      <p className="muted">
        The streak does not bend. Miss anything, any day, and you are back to day 1. What bends is
        how hard the training has to be — that follows your cycle.
      </p>

      <h2>You</h2>
      <Card>
        <Field label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        </Field>
        <Field
          label="Bodyweight (kg)"
          hint="Sets your water target at roughly 35ml per kg. Once you start logging daily weigh-ins, the target follows those instead."
        >
          <DecimalInput
            value={weight}
            onChange={setWeight}
            placeholder="60.0"
            ariaLabel="Bodyweight in kilograms"
          />
        </Field>
      </Card>

      <h2>Your cycle</h2>
      <Card>
        <Field
          label="First day of your last period"
          hint="This anchors every phase estimate. You can add it later, but targets stay neutral until you do."
        >
          <input type="date" value={lastPeriod} max={today} onChange={(e) => setLastPeriod(e.target.value)} />
        </Field>
        <Field label="Usual cycle length (days)" hint="A starting guess. The app replaces it with your real average once you have logged a few periods.">
          <input type="number" inputMode="numeric" value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} />
        </Field>
        <Field label="Usual period length (days)">
          <input type="number" inputMode="numeric" value={periodLength} onChange={(e) => setPeriodLength(e.target.value)} />
        </Field>
      </Card>

      <h2>Your rules</h2>
      <Card>
        <Field
          label="Nutrition plan"
          hint="Write it in your own words. You are committing to this for 75 days with no cheat meals and no alcohol — so make it something you can actually hold."
        >
          <textarea
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="e.g. Whole foods, protein at every meal, no added sugar, no alcohol."
          />
        </Field>
        <Field label="Start date">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </Card>

      <Card>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Every day: one 45-minute workout at the prescribed intensity, 30 minutes outdoors walking or
          running, your water target, your nutrition plan with zero exceptions, a cold shower, a
          meditation sit, and a progress photo. Reading 10 pages and logging your weight are tracked
          but optional — neither can ever cost you a day.
        </p>
      </Card>

      <button className="btn primary block" disabled={!ready} onClick={begin}>
        {ready ? 'Start day 1' : 'Fill in weight and nutrition plan'}
      </button>
      <p className="hint center">
        Everything stays on this device. Nothing is uploaded anywhere.
      </p>
    </div>
  );
}

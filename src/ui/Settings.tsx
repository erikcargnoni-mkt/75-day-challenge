import { useRef, useState } from 'react';
import { abandonChallenge, initialState, updateProfile, weightOn } from '../core/challenge';
import { exportJSON, importJSON, localStore } from '../core/storage';
import { waterTargetMl } from '../core/targets';
import { phaseFor } from '../core/cycle';
import { useApp } from '../state/useApp';
import { Card, DecimalInput, Field, ml, parseDecimal } from './bits';
import { LockSettings } from './LockSettings';

/**
 * Holds a text draft rather than writing the number straight through, so the
 * field can sit at "60," mid-edit. An unparseable draft is simply not committed,
 * which keeps the profile from ever holding NaN.
 */
function StartWeightInput({ value, onChange }: { value: number; onChange: (kg: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <DecimalInput
      value={draft}
      ariaLabel="Starting bodyweight in kilograms"
      onChange={(text) => {
        setDraft(text);
        const n = parseDecimal(text);
        if (n !== null && n >= 25 && n <= 300) onChange(n);
      }}
    />
  );
}

export function Settings() {
  const { state, apply, replace, today } = useApp();
  const p = state.profile;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const set = (patch: Parameters<typeof updateProfile>[1]) => apply((s) => updateProfile(s, patch));
  const info = phaseFor(today, state.cycle, state.profile);

  const download = () => {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `75-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const parsed = importJSON(await file.text());
    if (parsed) replace(parsed);
    else alert('That file could not be read as a 75 backup.');
  };

  return (
    <div className="screen">
      <h1>Settings</h1>

      <h2>You</h2>
      <Card>
        <Field label="Name">
          <input type="text" value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field
          label="Starting bodyweight (kg)"
          hint={`Today's water target: ${ml(waterTargetMl(weightOn(state, today), info))} — scaled from your most recent weigh-in.`}
        >
          <StartWeightInput value={p.weightKg} onChange={(kg) => set({ weightKg: kg })} />
        </Field>
      </Card>

      <h2>Cycle model</h2>
      <Card>
        <Field
          label="Default cycle length (days)"
          hint="Only used until you have logged at least two period starts. After that your own median wins."
        >
          <input
            type="number"
            inputMode="numeric"
            value={p.defaultCycleLength}
            onChange={(e) => set({ defaultCycleLength: Number(e.target.value) })}
          />
        </Field>
        <Field label="Period length (days)">
          <input
            type="number"
            inputMode="numeric"
            value={p.periodLength}
            onChange={(e) => set({ periodLength: Number(e.target.value) })}
          />
        </Field>
      </Card>

      <h2>Daily rules</h2>
      <Card>
        <Field label="Nutrition plan">
          <textarea value={p.nutritionPlan} onChange={(e) => set({ nutritionPlan: e.target.value })} />
        </Field>
        <div className="row" style={{ gap: 12 }}>
          <Field label="Workout (min)">
            <input
              type="number"
              inputMode="numeric"
              value={p.workoutMinutes}
              onChange={(e) => set({ workoutMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Outdoors (min)">
            <input
              type="number"
              inputMode="numeric"
              value={p.outdoorMinutes}
              onChange={(e) => set({ outdoorMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Pages">
            <input
              type="number"
              inputMode="numeric"
              value={p.readingPages}
              onChange={(e) => set({ readingPages: Number(e.target.value) })}
            />
          </Field>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Changing these mid-challenge changes what past days are measured against. Set them once and
          leave them alone.
        </p>
      </Card>

      <h2>Lock</h2>
      <LockSettings name={p.name} />

      <h2>Your data</h2>
      <Card>
        <p className="small muted">
          Everything lives on this device — the challenge log in local storage, photos in IndexedDB.
          Nothing is sent anywhere, and there is no account. The flip side is that clearing your
          browser data takes it with it, so export a backup now and then.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn grow" onClick={download}>
            Export backup
          </button>
          <button className="btn grow" onClick={() => fileRef.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={fileRef}
          className="hidden-input"
          type="file"
          accept="application/json"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <p className="hint" style={{ marginBottom: 0 }}>
          Photos are not included in the export — they stay on the device by design.
        </p>
      </Card>

      <h2>Danger</h2>
      <Card>
        {state.current && (
          <>
            {confirmAbandon ? (
              <div className="stack">
                <p className="small" style={{ marginBottom: 0 }}>
                  This ends the current attempt at day {state.current.reachedDay} and files it as a
                  reset. It cannot be undone.
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn danger grow"
                    onClick={() => {
                      apply((s) => abandonChallenge(s, today));
                      setConfirmAbandon(false);
                    }}
                  >
                    End it
                  </button>
                  <button className="btn ghost grow" onClick={() => setConfirmAbandon(false)}>
                    Keep going
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn danger block" onClick={() => setConfirmAbandon(true)}>
                Abandon current attempt
              </button>
            )}
            <hr />
          </>
        )}

        {confirmWipe ? (
          <div className="stack">
            <p className="small" style={{ marginBottom: 0 }}>
              This deletes your profile, every attempt, and all cycle history from this device.
              Photos stay until you clear site data. There is no undo.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn danger grow"
                onClick={() => {
                  localStore.clear();
                  replace(initialState());
                  setConfirmWipe(false);
                }}
              >
                Erase everything
              </button>
              <button className="btn ghost grow" onClick={() => setConfirmWipe(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn danger block" onClick={() => setConfirmWipe(true)}>
            Erase all data
          </button>
        )}
      </Card>

      <p className="hint center">
        Not a medical device. Phase estimates are arithmetic, not diagnosis — if something about your
        cycle or your training worries you, talk to a clinician.
      </p>
    </div>
  );
}

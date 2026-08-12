import { useEffect, useState } from 'react';
import {
  createPin,
  isValidPin,
  NO_LOCK,
  PIN_LENGTH,
  registerSuccess,
  verifyPin,
} from '../core/lock';
import { isBiometricAvailable, registerBiometric } from '../platform/biometric';
import { clearLock } from '../platform/lockStore';
import { useLock } from '../state/useLock';
import { Card, Field } from './bits';

export function LockSettings({ name }: { name: string }) {
  const { config, setConfig, enabled, lockNow } = useLock();
  const [biometricPossible, setBiometricPossible] = useState(false);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [mode, setMode] = useState<'idle' | 'set' | 'remove'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then(setBiometricPossible);
  }, []);

  const reset = () => {
    setPin('');
    setConfirm('');
    setCurrent('');
    setError(null);
    setMode('idle');
  };

  const save = async () => {
    if (!isValidPin(pin)) return setError(`The PIN must be ${PIN_LENGTH} digits.`);
    if (pin !== confirm) return setError('The two PINs do not match.');
    setBusy(true);
    try {
      setConfig({ ...NO_LOCK, pin: await createPin(pin) });
      reset();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!config.pin) return;
    setBusy(true);
    try {
      if (!(await verifyPin(current, config.pin))) {
        setError('That PIN is not right.');
        return;
      }
      clearLock();
      setConfig(NO_LOCK);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const addBiometric = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await registerBiometric(name || 'me');
      if (id) setConfig(registerSuccess({ ...config, biometricId: id }));
      else setError('The device did not complete setup. Your PIN still works.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {!enabled ? (
        mode === 'set' ? (
          <>
            <Field label={`New PIN (${PIN_LENGTH} digits)`}>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Confirm PIN">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={PIN_LENGTH}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
            <p className="hint" style={{ marginTop: 0 }}>
              There is no recovery. Forget this PIN and the only way back in is clearing the app's
              data, which erases the challenge and every photo with it.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary grow" disabled={busy} onClick={() => void save()}>
                Turn on lock
              </button>
              <button className="btn ghost grow" onClick={reset}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small muted">
              Off. Anyone holding this phone unlocked can open the app and see your photos.
            </p>
            <button className="btn block" onClick={() => setMode('set')}>
              Set a PIN
            </button>
          </>
        )
      ) : mode === 'remove' ? (
        <>
          <Field label="Enter your current PIN">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={PIN_LENGTH}
              value={current}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn danger grow" disabled={busy} onClick={() => void remove()}>
              Turn off lock
            </button>
            <button className="btn ghost grow" onClick={reset}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="col">
              <span className="title">Lock is on</span>
              <span className="sub">
                {config.biometricId
                  ? 'Face ID or Touch ID, with your PIN as backup.'
                  : 'PIN only on this device.'}
              </span>
            </div>
            <span className="pill">Locked</span>
          </div>

          {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}

          <div className="stack">
            {config.biometricId ? (
              <button
                className="btn block"
                onClick={() => setConfig({ ...config, biometricId: null })}
              >
                Remove Face ID / Touch ID
              </button>
            ) : (
              biometricPossible && (
                <button className="btn block" disabled={busy} onClick={() => void addBiometric()}>
                  Add Face ID / Touch ID
                </button>
              )
            )}
            <button className="btn block" onClick={lockNow}>
              Lock now
            </button>
            <button className="btn danger block" onClick={() => setMode('remove')}>
              Turn off lock
            </button>
          </div>
        </>
      )}

      <p className="hint" style={{ marginBottom: 0 }}>
        This locks the screen. It does not encrypt what is stored — it stops someone picking up your
        phone, not someone with developer tools. Nothing ever leaves the device either way.
      </p>
    </Card>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PIN_LENGTH,
  registerFailure,
  registerSuccess,
  remainingCooldownMs,
  verifyPin,
} from '../core/lock';
import { verifyBiometric } from '../platform/biometric';
import { useLock } from '../state/useLock';

/**
 * The lock screen.
 *
 * Biometrics are offered first and fire automatically on open, because the
 * common case is her own thumb. The PIN is always available underneath — a
 * biometric that can strand you out of your own data is worse than no lock.
 */
export function LockScreen() {
  const { config, setConfig, unlock } = useLock();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(() => remainingCooldownMs(config, Date.now()));
  const biometricTried = useRef(false);

  // Tick the cooldown down so the keypad re-enables without a reload.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(remainingCooldownMs(config, Date.now())), 500);
    return () => clearInterval(id);
  }, [cooldown, config]);

  const tryBiometric = useCallback(async () => {
    if (!config.biometricId) return;
    setError(null);
    const ok = await verifyBiometric(config.biometricId);
    if (ok) {
      setConfig(registerSuccess(config));
      unlock();
    }
  }, [config, setConfig, unlock]);

  // Offer Face ID the moment the screen appears, once.
  useEffect(() => {
    if (biometricTried.current || !config.biometricId) return;
    biometricTried.current = true;
    void tryBiometric();
  }, [config.biometricId, tryBiometric]);

  const submit = useCallback(
    async (pin: string) => {
      if (!config.pin || checking) return;
      setChecking(true);
      try {
        const ok = await verifyPin(pin, config.pin);
        if (ok) {
          setConfig(registerSuccess(config));
          unlock();
          return;
        }
        const next = registerFailure(config, Date.now());
        setConfig(next);
        setCooldown(remainingCooldownMs(next, Date.now()));
        setEntry('');
        setError('Wrong PIN.');
      } finally {
        setChecking(false);
      }
    },
    [config, checking, setConfig, unlock],
  );

  const press = (digit: string) => {
    if (cooldown > 0 || checking) return;
    setError(null);
    const next = (entry + digit).slice(0, PIN_LENGTH);
    setEntry(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const waiting = cooldown > 0;

  return (
    <div className="lockscreen">
      <div className="lock-inner">
        <div className="lock-mark" aria-hidden="true">
          ◐
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Locked</h1>
        <p className="small muted" style={{ marginBottom: 22 }}>
          {waiting
            ? `Too many attempts. Try again in ${Math.ceil(cooldown / 1000)}s.`
            : error ?? 'Enter your PIN to open.'}
        </p>

        <div className="pin-dots" aria-label={`${entry.length} of ${PIN_LENGTH} digits entered`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <i key={i} className={i < entry.length ? 'on' : ''} />
          ))}
        </div>

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} onClick={() => press(d)} disabled={waiting || checking}>
              {d}
            </button>
          ))}
          <button
            className="ghost"
            onClick={() => void tryBiometric()}
            disabled={!config.biometricId || waiting}
            aria-label="Unlock with Face ID"
          >
            {config.biometricId ? '☺' : ''}
          </button>
          <button onClick={() => press('0')} disabled={waiting || checking}>
            0
          </button>
          <button
            className="ghost"
            onClick={() => setEntry((e) => e.slice(0, -1))}
            disabled={waiting || checking || entry.length === 0}
            aria-label="Delete"
          >
            ⌫
          </button>
        </div>

        {config.biometricId && !waiting && (
          <button className="btn ghost block" style={{ marginTop: 18 }} onClick={() => void tryBiometric()}>
            Use Face ID
          </button>
        )}
      </div>
    </div>
  );
}

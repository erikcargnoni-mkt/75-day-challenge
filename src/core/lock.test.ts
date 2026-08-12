import { describe, it, expect } from 'vitest';
import {
  cooldownMsFor,
  createPin,
  isLockEnabled,
  isValidPin,
  NO_LOCK,
  registerFailure,
  registerSuccess,
  remainingCooldownMs,
  verifyPin,
} from './lock';

describe('PIN records', () => {
  it('never stores the PIN itself', async () => {
    const rec = await createPin('427193');
    expect(JSON.stringify(rec)).not.toContain('427193');
    expect(rec.hash).not.toBe('427193');
  });

  it('accepts the right PIN', async () => {
    const rec = await createPin('427193');
    expect(await verifyPin('427193', rec)).toBe(true);
  });

  it('rejects the wrong PIN, including near misses', async () => {
    const rec = await createPin('427193');
    for (const wrong of ['427194', '427192', '000000', '931724']) {
      expect(await verifyPin(wrong, rec)).toBe(false);
    }
  });

  it('salts each install separately, so the same PIN hashes differently', async () => {
    const a = await createPin('111111');
    const b = await createPin('111111');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // ...and each still verifies against its own record.
    expect(await verifyPin('111111', a)).toBe(true);
    expect(await verifyPin('111111', b)).toBe(true);
  });

  it('uses a work factor that is not a token gesture', async () => {
    const rec = await createPin('427193');
    expect(rec.iterations).toBeGreaterThanOrEqual(210_000);
  });

  it('refuses malformed PINs rather than hashing them', async () => {
    for (const bad of ['', '123', '1234567', 'abcdef', '12 456', '12345a']) {
      expect(isValidPin(bad)).toBe(false);
      await expect(createPin(bad)).rejects.toThrow();
    }
  });

  it('rejects a malformed attempt without touching the record', async () => {
    const rec = await createPin('427193');
    expect(await verifyPin('42719', rec)).toBe(false);
    expect(await verifyPin('', rec)).toBe(false);
  });
});

describe('throttling', () => {
  it('lets the first few slips through without penalty', () => {
    expect(cooldownMsFor(0)).toBe(0);
    expect(cooldownMsFor(4)).toBe(0);
  });

  it('escalates the wait as attempts pile up', () => {
    expect(cooldownMsFor(5)).toBe(30_000);
    expect(cooldownMsFor(10)).toBe(5 * 60_000);
    expect(cooldownMsFor(15)).toBe(60 * 60_000);
    expect(cooldownMsFor(500)).toBe(60 * 60_000);
  });

  it('starts a cooldown once the threshold is crossed', () => {
    let config = NO_LOCK;
    for (let i = 0; i < 5; i++) config = registerFailure(config, 1_000);
    expect(config.failedAttempts).toBe(5);
    expect(remainingCooldownMs(config, 1_000)).toBe(30_000);
    expect(remainingCooldownMs(config, 31_000)).toBe(0);
  });

  it('clears the penalty on a correct entry', () => {
    let config = NO_LOCK;
    for (let i = 0; i < 7; i++) config = registerFailure(config, 0);
    config = registerSuccess(config);
    expect(config.failedAttempts).toBe(0);
    expect(remainingCooldownMs(config, 0)).toBe(0);
  });
});

describe('isLockEnabled', () => {
  it('is off until a PIN exists', async () => {
    expect(isLockEnabled(NO_LOCK)).toBe(false);
    expect(isLockEnabled({ ...NO_LOCK, biometricId: 'abc' })).toBe(false);
    expect(isLockEnabled({ ...NO_LOCK, pin: await createPin('427193') })).toBe(true);
  });
});

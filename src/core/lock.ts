/**
 * App lock.
 *
 * Scope, stated plainly so nobody mistakes it for more than it is: this gates the
 * *screen*. The challenge log and the photos stay unencrypted in browser storage,
 * so this stops a person holding an unlocked phone — the actual threat — and not
 * someone with developer tools and time. Encrypting the photos at rest is a
 * separate, larger job with a real cost: forget the PIN and they are gone.
 *
 * The PIN is never stored. Only a PBKDF2-SHA256 derivation of it is, with a
 * random per-install salt, so the stored record cannot be read back into a PIN.
 */

/** OWASP's floor for PBKDF2-HMAC-SHA256. */
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

export const PIN_LENGTH = 6;

export interface PinRecord {
  /** base64 */
  salt: string;
  /** base64 */
  hash: string;
  iterations: number;
}

export interface LockConfig {
  pin: PinRecord | null;
  /** Credential id of the registered platform authenticator, base64url. */
  biometricId: string | null;
  failedAttempts: number;
  /** Epoch ms until which PIN entry is refused. */
  lockedUntil: number | null;
}

export const NO_LOCK: LockConfig = {
  pin: null,
  biometricId: null,
  failedAttempts: 0,
  lockedUntil: null,
};

export const isLockEnabled = (config: LockConfig): boolean => config.pin !== null;

// ---------------------------------------------------------------------------

const enc = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Length-independent, branch-free comparison. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function createPin(pin: string): Promise<PinRecord> {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${PIN_LENGTH} digits`);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, ITERATIONS);
  return { salt: toB64(salt), hash: toB64(hash), iterations: ITERATIONS };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const hash = await derive(pin, fromB64(record.salt), record.iterations);
  return constantTimeEqual(hash, fromB64(record.hash));
}

// ---------------------------------------------------------------------------
// Throttling
// ---------------------------------------------------------------------------

/**
 * A six-digit PIN is only a million guesses, and a script does not get bored.
 * PBKDF2 alone makes each attempt slow; this makes a run of them pointless.
 */
export function cooldownMsFor(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  if (failedAttempts < 10) return 30_000;
  if (failedAttempts < 15) return 5 * 60_000;
  return 60 * 60_000;
}

export function registerFailure(config: LockConfig, now: number): LockConfig {
  const failedAttempts = config.failedAttempts + 1;
  const cooldown = cooldownMsFor(failedAttempts);
  return {
    ...config,
    failedAttempts,
    lockedUntil: cooldown > 0 ? now + cooldown : null,
  };
}

export function registerSuccess(config: LockConfig): LockConfig {
  return { ...config, failedAttempts: 0, lockedUntil: null };
}

/** Milliseconds still to wait before another PIN attempt is accepted. */
export function remainingCooldownMs(config: LockConfig, now: number): number {
  if (config.lockedUntil === null) return 0;
  return Math.max(0, config.lockedUntil - now);
}

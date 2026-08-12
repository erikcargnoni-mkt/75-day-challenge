/**
 * Face ID / Touch ID via WebAuthn's platform authenticator.
 *
 * This lives outside core/ because it is a browser API a native port would
 * replace wholesale with LocalAuthentication.
 *
 * Honest framing: WebAuthn is built for a server to verify an assertion. Here
 * there is no server, so what we actually get is the OS performing user
 * verification and handing back a signature we accept on sight. That is a real
 * gate against a person holding the phone and no gate at all against someone
 * running a debugger — which is why the PIN, not this, is the thing the lock
 * is anchored on.
 */

const RP_NAME = '75';

function toB64Url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isBiometricPossible(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof PublicKeyCredential !== 'undefined' &&
    !!navigator.credentials
  );
}

/** Whether this device actually has a built-in authenticator to offer. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricPossible()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Registers a platform credential. Returns its id, or null if declined. */
export async function registerBiometric(label: string): Promise<string | null> {
  if (!isBiometricPossible()) return null;
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: RP_NAME, id: window.location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: label || 'me',
          displayName: label || 'me',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return credential ? toB64Url(credential.rawId) : null;
  } catch {
    return null;
  }
}

/** Prompts for Face ID / Touch ID. True only on a verified assertion. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  if (!isBiometricPossible()) return false;
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64Url(credentialId) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return assertion !== null;
  } catch {
    return false;
  }
}

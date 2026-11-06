// TOTP (RFC 6238) on top of HOTP (RFC 4226), using only node:crypto.
// Settings match what Google Authenticator and Microsoft Authenticator expect:
// SHA-1, 6 digits, 30-second steps, Base32 secret.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DIGITS = 6;
export const STEP_SECONDS = 30;
/** Accept the previous and next step too, to allow for a phone clock that is up to ~30s off. */
export const WINDOW = 1;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = str.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid Base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random 160-bit secret (the size RFC 4226 recommends for SHA-1), Base32 encoded. */
export function generateSecret() {
  return base32Encode(randomBytes(20));
}

export function hotp(secretBuf, counter, digits = DIGITS, algorithm = 'sha1') {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm, secretBuf).update(msg).digest();
  // Dynamic truncation, RFC 4226 section 5.3.
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function stepAt(nowMs) {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** The code an authenticator app shows at `nowMs`. Used by tests; the server never sends codes anywhere. */
export function totpAt(secretBase32, nowMs) {
  return hotp(base32Decode(secretBase32), stepAt(nowMs));
}

/**
 * Check a 6-digit code. Returns the time step it matched, or null.
 * Steps at or before `lastUsedStep` are rejected, so a code can't be replayed.
 */
export function verifyTotp(secretBase32, code, { nowMs = Date.now(), lastUsedStep = -1 } = {}) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const given = Buffer.from(code);
  const current = stepAt(nowMs);
  let matched = null;
  // Check every step in the window (no early exit) so timing doesn't reveal which one matched.
  for (let step = current - WINDOW; step <= current + WINDOW; step++) {
    const ok = timingSafeEqual(Buffer.from(hotp(secret, step)), given);
    if (ok && step > lastUsedStep && matched === null) matched = step;
  }
  return matched;
}

/** otpauth:// link that authenticator apps read from the QR code (Key URI format). */
export function otpauthUrl({ secret, accountName, issuer }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}

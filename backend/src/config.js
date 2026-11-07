import { hkdfSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
export const DB_PATH = process.env.DB_PATH ?? join(DATA_DIR, 'saveman.db');
/** Set both to use a Turso database (online SQLite) instead of the local file, e.g. when hosted on Render. */
export const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || undefined;
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;
const KEY_PATH = join(DATA_DIR, 'master.key');

export const PORT = Number(process.env.PORT ?? 4000);
/** 0.0.0.0 = every network adapter, so a phone on the same Wi-Fi can connect. */
export const HOST = process.env.HOST ?? '0.0.0.0';
/** How many proxies sit in front of the API. Render has one, so set TRUST_PROXY=1 there. */
export const TRUST_PROXY = Number(process.env.TRUST_PROXY ?? 0);

/** Shown in authenticator apps next to the account. No spaces, so it reads cleanly in every app. */
export const ISSUER = 'SaveMan';

/** Roles that must use MFA. Clients can turn it on themselves. */
export const MFA_REQUIRED_ROLES = new Set(['admin', 'consultant']);

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // after the password, to enter the code
export const MFA_SETUP_TTL_MS = 15 * 60 * 1000; // after the password, to enrol (required roles)
export const PENDING_SECRET_TTL_MS = 10 * 60 * 1000; // a scanned-but-unconfirmed secret

export const MAX_PASSWORD_FAILURES = 5;
export const MAX_MFA_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * 32-byte master key from MFA_MASTER_KEY (64 hex or 44 base64 characters). In development, if it isn't set,
 * one is generated once and kept in data/master.key (git-ignored). Losing it makes stored TOTP
 * secrets unreadable, so users would need to set MFA up again.
 */
function loadMasterKey() {
  const fromEnv = process.env.MFA_MASTER_KEY?.trim();
  if (fromEnv) {
    if (/^[0-9a-fA-F]{64}$/.test(fromEnv)) return Buffer.from(fromEnv, 'hex');
    // Base64 too, which is what Render's generateValue produces (see render.yaml).
    const b64 = Buffer.from(fromEnv, 'base64');
    if (b64.length === 32) return b64;
    throw new Error('MFA_MASTER_KEY must be 32 bytes: 64 hex characters or 44 base64 characters.');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Set MFA_MASTER_KEY in production.');
  if (!existsSync(KEY_PATH)) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(KEY_PATH, randomBytes(32).toString('hex'), { mode: 0o600 });
    console.warn(`Generated a development master key in ${KEY_PATH}. Set MFA_MASTER_KEY in production.`);
  }
  return Buffer.from(readFileSync(KEY_PATH, 'utf8').trim(), 'hex');
}

/** Separate keys for separate jobs, derived from the one master key. */
export function deriveKeys(master = loadMasterKey()) {
  const derive = (info) => Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32));
  return { secretKey: derive('saveman totp secret encryption'), recoveryKey: derive('saveman recovery code hmac') };
}

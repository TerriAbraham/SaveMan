import { randomUUID } from 'node:crypto';

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import QRCode from 'qrcode';

import {
  ISSUER,
  LOCKOUT_MS,
  MAX_MFA_FAILURES,
  MAX_PASSWORD_FAILURES,
  MFA_CHALLENGE_TTL_MS,
  MFA_REQUIRED_ROLES,
  MFA_SETUP_TTL_MS,
  PENDING_SECRET_TTL_MS,
  SESSION_TTL_MS,
} from './config.js';
import {
  DUMMY_PASSWORD_HASH,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashPassword,
  hashRecoveryCode,
  hashToken,
  newToken,
  verifyPassword,
} from './security.js';
import { generateSecret, otpauthUrl, verifyTotp } from './totp.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const minutes = (ms) => Math.max(1, Math.ceil(ms / 60000));
const str = (v, max = 200) => (typeof v === 'string' && v.length <= max ? v : '');

/**
 * @param {object} opts
 * @param {import('node:sqlite').DatabaseSync} opts.db
 * @param {{ secretKey: Buffer, recoveryKey: Buffer }} opts.keys
 * @param {() => number} [opts.now] clock, replaceable in tests
 * @param {{ auth: number, mfa: number }} [opts.limits] requests per IP per 15 minutes
 */
export function createApp({ db, keys, now = Date.now, limits = { auth: 20, mfa: 30 } }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      // Bearer tokens, no cookies, so any origin is safe (needed for the Expo web build).
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const limiter = (limit) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({ error: { code: 'rate_limited', message: 'Too many attempts. Please wait a few minutes and try again.' } }),
    });
  const authLimiter = limiter(limits.auth);
  const mfaLimiter = limiter(limits.mfa);

  // ---- Data helpers --------------------------------------------------------------------------

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare(
      'INSERT INTO users (id, email, name, role, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    insertToken: db.prepare('INSERT INTO tokens (token_hash, user_id, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'),
    tokenByHash: db.prepare('SELECT * FROM tokens WHERE token_hash = ?'),
    deleteToken: db.prepare('DELETE FROM tokens WHERE token_hash = ?'),
    deleteExpired: db.prepare('DELETE FROM tokens WHERE expires_at <= ?'),
    deleteOtherSessions: db.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'session' AND token_hash != ?"),
    bumpTokenAttempts: db.prepare('UPDATE tokens SET attempts = attempts + 1 WHERE token_hash = ? RETURNING attempts'),
    countRecovery: db.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL'),
    useRecovery: db.prepare('UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL'),
    deleteRecovery: db.prepare('DELETE FROM recovery_codes WHERE user_id = ?'),
    insertRecovery: db.prepare('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)'),
  };

  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  function publicUser(u) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, mfaEnabled: !!u.mfa_enabled, mfaRequired: MFA_REQUIRED_ROLES.has(u.role) };
  }

  function issueToken(userId, kind) {
    const t = now();
    q.deleteExpired.run(t);
    const token = newToken();
    const ttl = kind === 'session' ? SESSION_TTL_MS : kind === 'mfa_challenge' ? MFA_CHALLENGE_TTL_MS : MFA_SETUP_TTL_MS;
    q.insertToken.run(hashToken(token), userId, kind, t + ttl, t);
    return token;
  }

  /** After the password: a session, or a short-lived token for the MFA step. */
  function afterPassword(user) {
    if (user.mfa_enabled) {
      return { status: 'mfa_required', mfaToken: issueToken(user.id, 'mfa_challenge'), user: publicUser(user) };
    }
    if (MFA_REQUIRED_ROLES.has(user.role)) {
      return { status: 'mfa_setup_required', mfaToken: issueToken(user.id, 'mfa_setup'), user: publicUser(user) };
    }
    return { status: 'ok', token: issueToken(user.id, 'session'), user: publicUser(user) };
  }

  function saveRecoveryCodes(userId) {
    const codes = generateRecoveryCodes();
    q.deleteRecovery.run(userId);
    for (const c of codes) q.insertRecovery.run(userId, hashRecoveryCode(c, keys.recoveryKey));
    return codes;
  }

  /**
   * Checks a 6-digit code, or a recovery code when `allowRecovery`. Repeated failures lock MFA
   * for the account (not just this device) for LOCKOUT_MS.
   */
  function checkSecondFactor(user, body, { allowRecovery = true } = {}) {
    const t = now();
    if (user.mfa_locked_until > t) {
      throw new ApiError(429, 'mfa_locked', `Too many wrong codes. Try again in ${minutes(user.mfa_locked_until - t)} minutes.`);
    }
    const code = str(body.code, 10).replace(/\s/g, '');
    const recoveryCode = allowRecovery ? str(body.recoveryCode, 40) : '';
    let usedRecoveryCode = false;
    let ok = false;

    if (code) {
      const step = verifyTotp(decryptSecret(user.mfa_secret_enc, keys.secretKey), code, { nowMs: t, lastUsedStep: user.mfa_last_step });
      if (step !== null) {
        db.prepare('UPDATE users SET mfa_last_step = ? WHERE id = ?').run(step, user.id);
        ok = true;
      }
    } else if (recoveryCode) {
      ok = q.useRecovery.run(t, user.id, hashRecoveryCode(recoveryCode, keys.recoveryKey)).changes === 1;
      usedRecoveryCode = ok;
    }

    if (ok) {
      db.prepare('UPDATE users SET mfa_failures = 0 WHERE id = ?').run(user.id);
      return { usedRecoveryCode };
    }
    const failures = user.mfa_failures + 1;
    if (failures >= MAX_MFA_FAILURES) {
      db.prepare('UPDATE users SET mfa_failures = 0, mfa_locked_until = ? WHERE id = ?').run(t + LOCKOUT_MS, user.id);
      throw new ApiError(429, 'mfa_locked', `Too many wrong codes. Try again in ${minutes(LOCKOUT_MS)} minutes.`);
    }
    db.prepare('UPDATE users SET mfa_failures = ? WHERE id = ?').run(failures, user.id);
    throw new ApiError(401, 'invalid_code', recoveryCode ? 'That recovery code is wrong or has already been used.' : 'That code is incorrect or has expired.');
  }

  function requirePassword(user, password) {
    if (!verifyPassword(str(password), user.password_hash)) throw new ApiError(401, 'invalid_password', 'Your password is incorrect.');
  }

  /** Bearer-token middleware. `kinds` are the token types this route accepts. */
  const auth = (...kinds) =>
    (req, _res, next) => {
      const header = req.get('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      const row = token ? q.tokenByHash.get(hashToken(token)) : undefined;
      if (!row || row.expires_at <= now() || !kinds.includes(row.kind)) {
        throw new ApiError(401, 'unauthorized', 'Your session has expired. Please log in again.');
      }
      const user = q.userById.get(row.user_id);
      if (!user) throw new ApiError(401, 'unauthorized', 'Your session has expired. Please log in again.');
      if (user.status !== 'active') throw new ApiError(403, 'account_suspended', 'This account has been suspended. Contact SaveMan support.');
      req.auth = { token, tokenHash: row.token_hash, kind: row.kind, attempts: row.attempts, user };
      next();
    };

  // ---- Routes --------------------------------------------------------------------------------

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', authLimiter, (req, res) => {
    const role = req.body?.role;
    const name = str(req.body?.name).trim();
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    // Admin accounts can't be created from the app.
    if (role !== 'client' && role !== 'consultant') throw new ApiError(400, 'invalid_role', 'Choose client or consultant.');
    if (name.length < 2) throw new ApiError(400, 'invalid_name', 'Enter your full name.');
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
    if (password.length < 6) throw new ApiError(400, 'weak_password', 'Use at least 6 characters.');
    if (q.userByEmail.get(email)) throw new ApiError(409, 'email_taken', 'An account with this email already exists.');

    const id = `u-${randomUUID()}`;
    q.insertUser.run(id, email, name, role, hashPassword(password), 'active', now());
    res.status(201).json(afterPassword(q.userById.get(id)));
  });

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    if (!email || !password) throw new ApiError(400, 'missing_fields', 'Enter your email and password.');

    const user = q.userByEmail.get(email);
    const t = now();
    if (user && user.login_locked_until > t) {
      throw new ApiError(429, 'account_locked', `Too many failed logins. Try again in ${minutes(user.login_locked_until - t)} minutes.`);
    }
    // Hash even when the email is unknown, so response time doesn't reveal which emails exist.
    const ok = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok) {
      if (user) {
        const failures = user.login_failures + 1;
        if (failures >= MAX_PASSWORD_FAILURES) {
          db.prepare('UPDATE users SET login_failures = 0, login_locked_until = ? WHERE id = ?').run(t + LOCKOUT_MS, user.id);
        } else {
          db.prepare('UPDATE users SET login_failures = ? WHERE id = ?').run(failures, user.id);
        }
      }
      throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password.');
    }
    db.prepare('UPDATE users SET login_failures = 0 WHERE id = ?').run(user.id);
    if (user.status !== 'active') throw new ApiError(403, 'account_suspended', 'This account has been suspended. Contact SaveMan support.');
    res.json(afterPassword(user));
  });

  app.post('/api/auth/mfa/verify', mfaLimiter, auth('mfa_challenge'), (req, res) => {
    const { user, tokenHash } = req.auth;
    let result;
    try {
      result = checkSecondFactor(user, req.body ?? {});
    } catch (err) {
      // Each challenge also gets a limited number of tries, then the password is needed again.
      const { attempts } = q.bumpTokenAttempts.get(tokenHash);
      if (attempts >= MAX_MFA_FAILURES) q.deleteToken.run(tokenHash);
      throw err;
    }
    q.deleteToken.run(tokenHash);
    res.json({
      status: 'ok',
      token: issueToken(user.id, 'session'),
      user: publicUser(user),
      usedRecoveryCode: result.usedRecoveryCode,
      recoveryCodesRemaining: q.countRecovery.get(user.id).n,
    });
  });

  app.post('/api/auth/logout', auth('session', 'mfa_challenge', 'mfa_setup'), (req, res) => {
    q.deleteToken.run(req.auth.tokenHash);
    res.json({ ok: true });
  });

  app.get('/api/mfa/status', auth('session'), (req, res) => {
    const { user } = req.auth;
    res.json({
      enabled: !!user.mfa_enabled,
      required: MFA_REQUIRED_ROLES.has(user.role),
      enabledAt: user.mfa_enabled_at,
      recoveryCodesRemaining: user.mfa_enabled ? q.countRecovery.get(user.id).n : 0,
    });
  });

  /**
   * Step 1 of turning MFA on, or of moving it to a new phone: a new secret to scan.
   * Moving it needs the password and a current code (or recovery code). The old authenticator
   * keeps working until the new one is confirmed.
   */
  app.post('/api/mfa/setup', mfaLimiter, auth('session', 'mfa_setup'), async (req, res) => {
    const { user } = req.auth;
    if (user.mfa_enabled) {
      requirePassword(user, req.body?.password);
      checkSecondFactor(user, req.body ?? {});
    }
    const secret = generateSecret();
    db.prepare('UPDATE users SET mfa_pending_enc = ?, mfa_pending_at = ? WHERE id = ?').run(
      encryptSecret(secret, keys.secretKey),
      now(),
      user.id,
    );
    const url = otpauthUrl({ secret, accountName: user.email, issuer: ISSUER });
    res.json({
      secret, // shown once so it can be typed in by hand
      otpauthUrl: url,
      qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M' }),
      expiresInSeconds: PENDING_SECRET_TTL_MS / 1000,
    });
  });

  /** Step 2: the first code from the app proves it was set up correctly. Returns new recovery codes. */
  app.post('/api/mfa/enable', mfaLimiter, auth('session', 'mfa_setup'), (req, res) => {
    const { user, kind, tokenHash } = req.auth;
    if (!user.mfa_pending_enc || now() - user.mfa_pending_at > PENDING_SECRET_TTL_MS) {
      throw new ApiError(400, 'no_pending_setup', 'This setup has expired. Start again to get a new QR code.');
    }
    const secretEnc = user.mfa_pending_enc;
    const step = verifyTotp(decryptSecret(secretEnc, keys.secretKey), str(req.body?.code, 10).replace(/\s/g, ''), { nowMs: now() });
    if (step === null) throw new ApiError(401, 'invalid_code', 'That code is incorrect. Check the time on your phone is set automatically.');

    const result = transaction(() => {
      db.prepare(
        `UPDATE users SET mfa_enabled = 1, mfa_secret_enc = ?, mfa_pending_enc = NULL, mfa_pending_at = NULL,
           mfa_last_step = ?, mfa_failures = 0, mfa_enabled_at = ? WHERE id = ?`,
      ).run(secretEnc, step, now(), user.id);
      const recoveryCodes = saveRecoveryCodes(user.id);
      let token;
      if (kind === 'mfa_setup') {
        // Enrolment during login: swap the setup token for a real session.
        q.deleteToken.run(tokenHash);
        token = issueToken(user.id, 'session');
      } else {
        q.deleteOtherSessions.run(user.id, tokenHash); // a changed authenticator signs out other devices
      }
      return { recoveryCodes, token };
    });
    res.json({ status: 'ok', ...result, user: publicUser(q.userById.get(user.id)) });
  });

  app.post('/api/mfa/recovery-codes', mfaLimiter, auth('session'), (req, res) => {
    const { user } = req.auth;
    if (!user.mfa_enabled) throw new ApiError(400, 'mfa_not_enabled', 'Turn on two-step verification first.');
    // Only the authenticator (not a recovery code) can make new recovery codes.
    checkSecondFactor(user, req.body ?? {}, { allowRecovery: false });
    res.json({ recoveryCodes: transaction(() => saveRecoveryCodes(user.id)) });
  });

  app.post('/api/mfa/disable', mfaLimiter, auth('session'), (req, res) => {
    const { user, tokenHash } = req.auth;
    if (MFA_REQUIRED_ROLES.has(user.role)) {
      throw new ApiError(403, 'mfa_required_for_role', 'Two-step verification is required for your account and can’t be turned off.');
    }
    if (!user.mfa_enabled) throw new ApiError(400, 'mfa_not_enabled', 'Two-step verification is already off.');
    requirePassword(user, req.body?.password);
    checkSecondFactor(user, req.body ?? {});
    transaction(() => {
      db.prepare(
        `UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_pending_at = NULL,
           mfa_last_step = -1, mfa_failures = 0, mfa_enabled_at = NULL WHERE id = ?`,
      ).run(user.id);
      q.deleteRecovery.run(user.id);
      q.deleteOtherSessions.run(user.id, tokenHash);
    });
    res.json({ status: 'ok', user: publicUser(q.userById.get(user.id)) });
  });

  app.use((_req, _res) => {
    throw new ApiError(404, 'not_found', 'Not found.');
  });

  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid request.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong. Please try again.' } });
  });

  return app;
}

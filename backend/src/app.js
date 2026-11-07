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
import { sql } from './db.js';
import { ApiError, str } from './http.js';
import { newProfile, toUser } from './profiles.js';
import { registerResources } from './resources.js';
import { generateSecret, otpauthUrl, verifyTotp } from './totp.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const minutes = (ms) => Math.max(1, Math.ceil(ms / 60000));

/**
 * @param {object} opts
 * @param {Awaited<ReturnType<typeof import('./db.js').openDb>>} opts.db
 * @param {{ secretKey: Buffer, recoveryKey: Buffer }} opts.keys
 * @param {() => number} [opts.now] clock, replaceable in tests
 * @param {{ auth: number, mfa: number }} [opts.limits] requests per IP per 15 minutes
 * @param {number | boolean} [opts.trustProxy] proxies in front of the API (1 on Render), so rate limits see real client IPs
 */
export function createApp({ db, keys, now = Date.now, limits = { auth: 20, mfa: 30 }, trustProxy = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: '100kb' })); // a consultant profile with services and qualifications

  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      // Bearer tokens, no cookies, so any origin is safe (needed for the Expo web build).
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

  const userByEmail = (email) => db.get('SELECT * FROM users WHERE email = ?', email);
  const userById = (id) => db.get('SELECT * FROM users WHERE id = ?', id);
  const countRecovery = async (userId) =>
    (await db.get('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', userId)).n;
  const deleteToken = (tokenHash) => db.run('DELETE FROM tokens WHERE token_hash = ?', tokenHash);
  const deleteOtherSessions = (userId, tokenHash) =>
    sql("DELETE FROM tokens WHERE user_id = ? AND kind = 'session' AND token_hash != ?", userId, tokenHash);

  function publicUser(u) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, mfaEnabled: !!u.mfa_enabled, mfaRequired: MFA_REQUIRED_ROLES.has(u.role) };
  }

  /** A new token plus the statements that store it, so callers can batch them with other writes. */
  function newTokenStatements(userId, kind) {
    const t = now();
    const token = newToken();
    const ttl = kind === 'session' ? SESSION_TTL_MS : kind === 'mfa_challenge' ? MFA_CHALLENGE_TTL_MS : MFA_SETUP_TTL_MS;
    return {
      token,
      statements: [
        sql('DELETE FROM tokens WHERE expires_at <= ?', t),
        sql('INSERT INTO tokens (token_hash, user_id, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', hashToken(token), userId, kind, t + ttl, t),
      ],
    };
  }

  async function issueToken(userId, kind) {
    const { token, statements } = newTokenStatements(userId, kind);
    await db.batch(statements);
    return token;
  }

  /** After the password: a session, or a short-lived token for the MFA step. */
  async function afterPassword(user) {
    if (user.mfa_enabled) {
      return { status: 'mfa_required', mfaToken: await issueToken(user.id, 'mfa_challenge'), user: publicUser(user) };
    }
    if (MFA_REQUIRED_ROLES.has(user.role)) {
      return { status: 'mfa_setup_required', mfaToken: await issueToken(user.id, 'mfa_setup'), user: publicUser(user) };
    }
    return { status: 'ok', token: await issueToken(user.id, 'session'), user: publicUser(user) };
  }

  /** New recovery codes plus the statements that replace the old ones. */
  function recoveryCodeStatements(userId) {
    const codes = generateRecoveryCodes();
    return {
      codes,
      statements: [
        sql('DELETE FROM recovery_codes WHERE user_id = ?', userId),
        ...codes.map((c) => sql('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)', userId, hashRecoveryCode(c, keys.recoveryKey))),
      ],
    };
  }

  /**
   * Checks a 6-digit code, or a recovery code when `allowRecovery`. Repeated failures lock MFA
   * for the account (not just this device) for LOCKOUT_MS.
   */
  async function checkSecondFactor(user, body, { allowRecovery = true } = {}) {
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
      // The step check in SQL stops two requests racing to use the same code.
      ok = step !== null && !!(await db.get('UPDATE users SET mfa_last_step = ? WHERE id = ? AND mfa_last_step < ? RETURNING id', step, user.id, step));
    } else if (recoveryCode) {
      ok = !!(await db.get(
        'UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL RETURNING id',
        t,
        user.id,
        hashRecoveryCode(recoveryCode, keys.recoveryKey),
      ));
      usedRecoveryCode = ok;
    }

    if (ok) {
      await db.run('UPDATE users SET mfa_failures = 0 WHERE id = ?', user.id);
      return { usedRecoveryCode };
    }
    const { mfa_failures: failures } = await db.get('UPDATE users SET mfa_failures = mfa_failures + 1 WHERE id = ? RETURNING mfa_failures', user.id);
    if (failures >= MAX_MFA_FAILURES) {
      await db.run('UPDATE users SET mfa_failures = 0, mfa_locked_until = ? WHERE id = ?', t + LOCKOUT_MS, user.id);
      throw new ApiError(429, 'mfa_locked', `Too many wrong codes. Try again in ${minutes(LOCKOUT_MS)} minutes.`);
    }
    throw new ApiError(401, 'invalid_code', recoveryCode ? 'That recovery code is wrong or has already been used.' : 'That code is incorrect or has expired.');
  }

  function requirePassword(user, password) {
    if (!verifyPassword(str(password), user.password_hash)) throw new ApiError(401, 'invalid_password', 'Your password is incorrect.');
  }

  /** The caller's token row and user, or null. Throws if the account is suspended. */
  async function lookupToken(req, kinds) {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const row = token ? await db.get('SELECT * FROM tokens WHERE token_hash = ?', hashToken(token)) : undefined;
    if (!row || row.expires_at <= now() || !kinds.includes(row.kind)) return null;
    const user = await userById(row.user_id);
    if (!user) return null;
    if (user.status !== 'active') throw new ApiError(403, 'account_suspended', 'This account has been suspended. Contact SaveMan support.');
    return { token, tokenHash: row.token_hash, kind: row.kind, attempts: row.attempts, user };
  }

  /** Bearer-token middleware. `kinds` are the token types this route accepts. */
  const auth =
    (...kinds) =>
    async (req, _res, next) => {
      req.auth = await lookupToken(req, kinds);
      if (!req.auth) throw new ApiError(401, 'unauthorized', 'Your session has expired. Please log in again.');
      next();
    };

  /** For routes anyone may call: sets req.auth when a valid session is sent, so the reply can depend on the role. */
  const optionalAuth = async (req, _res, next) => {
    req.auth = await lookupToken(req, ['session']);
    next();
  };

  // ---- Routes --------------------------------------------------------------------------------

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const role = req.body?.role;
    const name = str(req.body?.name).trim();
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    // Admin accounts can't be created from the app.
    if (role !== 'client' && role !== 'consultant') throw new ApiError(400, 'invalid_role', 'Choose client or consultant.');
    if (name.length < 2) throw new ApiError(400, 'invalid_name', 'Enter your full name.');
    if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
    if (password.length < 6) throw new ApiError(400, 'weak_password', 'Use at least 6 characters.');
    const profileInput = {
      phone: str(req.body?.phone, 30).trim(),
      city: str(req.body?.city, 60),
      title: str(req.body?.title, 100).trim(),
      categoryId: str(req.body?.categoryId, 60),
    };

    const id = `u-${randomUUID()}`;
    const createdAt = now();
    // ON CONFLICT instead of checking first, so two sign-ups with the same email can't both get through.
    const inserted = await db.get(
      'INSERT INTO users (id, email, name, role, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING RETURNING id',
      id,
      email,
      name,
      role,
      hashPassword(password),
      'active',
      createdAt,
    );
    if (!inserted) throw new ApiError(409, 'email_taken', 'An account with this email already exists.');
    await db.run('INSERT INTO profiles (user_id, data) VALUES (?, ?)', id, JSON.stringify(newProfile(role, profileInput, createdAt)));
    res.status(201).json(await afterPassword(await userById(id)));
  });

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const email = str(req.body?.email).trim().toLowerCase();
    const password = str(req.body?.password);
    if (!email || !password) throw new ApiError(400, 'missing_fields', 'Enter your email and password.');

    const user = await userByEmail(email);
    const t = now();
    if (user && user.login_locked_until > t) {
      throw new ApiError(429, 'account_locked', `Too many failed logins. Try again in ${minutes(user.login_locked_until - t)} minutes.`);
    }
    // Hash even when the email is unknown, so response time doesn't reveal which emails exist.
    const ok = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok) {
      if (user) {
        const { login_failures: failures } = await db.get(
          'UPDATE users SET login_failures = login_failures + 1 WHERE id = ? RETURNING login_failures',
          user.id,
        );
        if (failures >= MAX_PASSWORD_FAILURES) {
          await db.run('UPDATE users SET login_failures = 0, login_locked_until = ? WHERE id = ?', t + LOCKOUT_MS, user.id);
        }
      }
      throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password.');
    }
    await db.run('UPDATE users SET login_failures = 0 WHERE id = ?', user.id);
    if (user.status !== 'active') throw new ApiError(403, 'account_suspended', 'This account has been suspended. Contact SaveMan support.');
    res.json(await afterPassword(user));
  });

  app.post('/api/auth/mfa/verify', mfaLimiter, auth('mfa_challenge'), async (req, res) => {
    const { user, tokenHash } = req.auth;
    let result;
    try {
      result = await checkSecondFactor(user, req.body ?? {});
    } catch (err) {
      // Each challenge also gets a limited number of tries, then the password is needed again.
      const row = await db.get('UPDATE tokens SET attempts = attempts + 1 WHERE token_hash = ? RETURNING attempts', tokenHash);
      if (row && row.attempts >= MAX_MFA_FAILURES) await deleteToken(tokenHash);
      throw err;
    }
    const session = newTokenStatements(user.id, 'session');
    await db.batch([sql('DELETE FROM tokens WHERE token_hash = ?', tokenHash), ...session.statements]);
    res.json({
      status: 'ok',
      token: session.token,
      user: publicUser(user),
      usedRecoveryCode: result.usedRecoveryCode,
      recoveryCodesRemaining: await countRecovery(user.id),
    });
  });

  /** The signed-in user's full profile. */
  app.get('/api/auth/me', auth('session'), async (req, res) => {
    const row = await db.get('SELECT data FROM profiles WHERE user_id = ?', req.auth.user.id);
    const profile = row ? JSON.parse(row.data) : newProfile(req.auth.user.role, {}, req.auth.user.created_at);
    res.json({ ...toUser(req.auth.user, profile), mfaEnabled: !!req.auth.user.mfa_enabled });
  });

  app.post('/api/auth/logout', auth('session', 'mfa_challenge', 'mfa_setup'), async (req, res) => {
    await deleteToken(req.auth.tokenHash);
    res.json({ ok: true });
  });

  app.get('/api/mfa/status', auth('session'), async (req, res) => {
    const { user } = req.auth;
    res.json({
      enabled: !!user.mfa_enabled,
      required: MFA_REQUIRED_ROLES.has(user.role),
      enabledAt: user.mfa_enabled_at,
      recoveryCodesRemaining: user.mfa_enabled ? await countRecovery(user.id) : 0,
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
      await checkSecondFactor(user, req.body ?? {});
    }
    const secret = generateSecret();
    await db.run('UPDATE users SET mfa_pending_enc = ?, mfa_pending_at = ? WHERE id = ?', encryptSecret(secret, keys.secretKey), now(), user.id);
    const url = otpauthUrl({ secret, accountName: user.email, issuer: ISSUER });
    res.json({
      secret, // shown once so it can be typed in by hand
      otpauthUrl: url,
      qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M' }),
      expiresInSeconds: PENDING_SECRET_TTL_MS / 1000,
    });
  });

  /** Step 2: the first code from the app proves it was set up correctly. Returns new recovery codes. */
  app.post('/api/mfa/enable', mfaLimiter, auth('session', 'mfa_setup'), async (req, res) => {
    const { user, kind, tokenHash } = req.auth;
    if (!user.mfa_pending_enc || now() - user.mfa_pending_at > PENDING_SECRET_TTL_MS) {
      throw new ApiError(400, 'no_pending_setup', 'This setup has expired. Start again to get a new QR code.');
    }
    const secretEnc = user.mfa_pending_enc;
    const step = verifyTotp(decryptSecret(secretEnc, keys.secretKey), str(req.body?.code, 10).replace(/\s/g, ''), { nowMs: now() });
    if (step === null) throw new ApiError(401, 'invalid_code', 'That code is incorrect. Check the time on your phone is set automatically.');

    // One batch, so MFA is never left half switched on.
    const recovery = recoveryCodeStatements(user.id);
    const statements = [
      sql(
        `UPDATE users SET mfa_enabled = 1, mfa_secret_enc = ?, mfa_pending_enc = NULL, mfa_pending_at = NULL,
           mfa_last_step = ?, mfa_failures = 0, mfa_enabled_at = ? WHERE id = ?`,
        secretEnc,
        step,
        now(),
        user.id,
      ),
      ...recovery.statements,
    ];
    let token;
    if (kind === 'mfa_setup') {
      // Enrolment during login: swap the setup token for a real session.
      const session = newTokenStatements(user.id, 'session');
      token = session.token;
      statements.push(sql('DELETE FROM tokens WHERE token_hash = ?', tokenHash), ...session.statements);
    } else {
      statements.push(deleteOtherSessions(user.id, tokenHash)); // a changed authenticator signs out other devices
    }
    await db.batch(statements);
    res.json({ status: 'ok', recoveryCodes: recovery.codes, token, user: publicUser(await userById(user.id)) });
  });

  app.post('/api/mfa/recovery-codes', mfaLimiter, auth('session'), async (req, res) => {
    const { user } = req.auth;
    if (!user.mfa_enabled) throw new ApiError(400, 'mfa_not_enabled', 'Turn on two-step verification first.');
    // Only the authenticator (not a recovery code) can make new recovery codes.
    await checkSecondFactor(user, req.body ?? {}, { allowRecovery: false });
    const recovery = recoveryCodeStatements(user.id);
    await db.batch(recovery.statements);
    res.json({ recoveryCodes: recovery.codes });
  });

  app.post('/api/mfa/disable', mfaLimiter, auth('session'), async (req, res) => {
    const { user, tokenHash } = req.auth;
    if (MFA_REQUIRED_ROLES.has(user.role)) {
      throw new ApiError(403, 'mfa_required_for_role', 'Two-step verification is required for your account and can’t be turned off.');
    }
    if (!user.mfa_enabled) throw new ApiError(400, 'mfa_not_enabled', 'Two-step verification is already off.');
    requirePassword(user, req.body?.password);
    await checkSecondFactor(user, req.body ?? {});
    await db.batch([
      sql(
        `UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_pending_at = NULL,
           mfa_last_step = -1, mfa_failures = 0, mfa_enabled_at = NULL WHERE id = ?`,
        user.id,
      ),
      sql('DELETE FROM recovery_codes WHERE user_id = ?', user.id),
      deleteOtherSessions(user.id, tokenHash),
    ]);
    res.json({ status: 'ok', user: publicUser(await userById(user.id)) });
  });

  registerResources(app, { db, auth, optionalAuth, now });

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

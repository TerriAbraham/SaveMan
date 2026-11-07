// End-to-end tests over HTTP: login, enrolment, verification, recovery, lockouts and disabling.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createApp } from '../src/app.js';
import { deriveKeys } from '../src/config.js';
import { openDb, seedIfEmpty } from '../src/db.js';
import { totpAt } from '../src/totp.js';

let clock = Date.parse('2026-11-07T09:00:00Z');
const tick = (ms) => (clock += ms);

async function startServer(opts = {}) {
  const db = await openDb({ path: ':memory:' });
  await seedIfEmpty(db);
  const app = createApp({ db, keys: deriveKeys(randomBytes(32)), now: () => clock, limits: { auth: 1000, mfa: 1000 }, ...opts });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(method, path, body, token) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  }
  return { db, server, call };
}

const login = (call, email, password) => call('POST', '/api/auth/login', { email, password });

/** Logs in a required-MFA user and enrols them. Returns the secret, recovery codes and session. */
async function enrol(call, email, password) {
  const res = await login(call, email, password);
  assert.equal(res.body.status, 'mfa_setup_required');
  const setup = await call('POST', '/api/mfa/setup', {}, res.body.mfaToken);
  assert.equal(setup.status, 200);
  const enabled = await call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, res.body.mfaToken);
  assert.equal(enabled.status, 200);
  tick(30_000); // move past the step just used, as a real user would
  return { secret: setup.body.secret, recoveryCodes: enabled.body.recoveryCodes, token: enabled.body.token };
}

describe('MFA flows', () => {
  let ctx;
  before(async () => (ctx = await startServer()));
  after(() => ctx.server.close());

  test('client without MFA logs straight in; wrong password is rejected generically', async () => {
    const ok = await login(ctx.call, 'client@saveman.pg', 'client123');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'ok');
    assert.equal(ok.body.user.mfaRequired, false);
    assert.ok(ok.body.token);

    const bad = await login(ctx.call, 'client@saveman.pg', 'nope');
    const unknown = await login(ctx.call, 'nobody@saveman.pg', 'nope');
    assert.equal(bad.status, 401);
    assert.deepEqual(bad.body, unknown.body, 'same error for unknown email and wrong password');
  });

  test('admin must enrol before getting a session; setup token is limited to enrolment', async () => {
    const res = await login(ctx.call, 'admin@saveman.pg', 'admin123');
    assert.equal(res.body.status, 'mfa_setup_required');
    assert.equal(res.body.token, undefined, 'no session yet');
    const token = res.body.mfaToken;

    assert.equal((await ctx.call('GET', '/api/mfa/status', null, token)).status, 401, 'setup token is not a session');

    const setup = await ctx.call('POST', '/api/mfa/setup', {}, token);
    assert.match(setup.body.secret, /^[A-Z2-7]{32}$/);
    assert.ok(setup.body.otpauthUrl.startsWith('otpauth://totp/SaveMan%3Aadmin%40saveman.pg?'));
    assert.ok(setup.body.qrDataUrl.startsWith('data:image/png;base64,'));

    const wrong = await ctx.call('POST', '/api/mfa/enable', { code: '000000' === totpAt(setup.body.secret, clock) ? '111111' : '000000' }, token);
    assert.equal(wrong.status, 401);

    const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, token);
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.recoveryCodes.length, 10);
    assert.match(enabled.body.recoveryCodes[0], /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    assert.ok(enabled.body.token, 'setup token swapped for a session');
    assert.equal(enabled.body.user.mfaEnabled, true);

    // The setup token is single use.
    assert.equal((await ctx.call('POST', '/api/mfa/enable', { code: '123456' }, token)).status, 401);

    // The secret and recovery codes are not stored in plain text.
    const row = await ctx.db.get('SELECT mfa_secret_enc FROM users WHERE id = ?', 'u-admin-1');
    assert.ok(!row.mfa_secret_enc.includes(setup.body.secret));
    const hashes = (await ctx.db.all('SELECT code_hash FROM recovery_codes WHERE user_id = ?', 'u-admin-1')).map((r) => r.code_hash);
    assert.equal(hashes.length, 10);
    for (const code of enabled.body.recoveryCodes) assert.ok(!hashes.includes(code));

    const status = await ctx.call('GET', '/api/mfa/status', null, enabled.body.token);
    assert.deepEqual({ ...status.body, enabledAt: undefined }, { enabled: true, required: true, recoveryCodesRemaining: 10, enabledAt: undefined });
  });

  test('login with TOTP; the same code cannot be replayed', async () => {
    const { secret } = await enrol(ctx.call, 'joanne@saveman.pg', 'consult123');

    const first = await login(ctx.call, 'joanne@saveman.pg', 'consult123');
    assert.equal(first.body.status, 'mfa_required');
    const code = totpAt(secret, clock);
    const ok = await ctx.call('POST', '/api/auth/mfa/verify', { code }, first.body.mfaToken);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.role, 'consultant');
    assert.ok(ok.body.token);

    const second = await login(ctx.call, 'joanne@saveman.pg', 'consult123');
    const replay = await ctx.call('POST', '/api/auth/mfa/verify', { code }, second.body.mfaToken);
    assert.equal(replay.status, 401, 'replayed code rejected');

    tick(30_000);
    const next = await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, second.body.mfaToken);
    assert.equal(next.status, 200);

    // Challenge tokens are single use and can't be used as sessions.
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, second.body.mfaToken)).status, 401);
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, first.body.mfaToken)).status, 401);
  });

  test('challenge expires after 5 minutes', async () => {
    const { secret } = await enrol(ctx.call, 'samuel@saveman.pg', 'consult123');
    const res = await login(ctx.call, 'samuel@saveman.pg', 'consult123');
    tick(5 * 60_000 + 1);
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, res.body.mfaToken)).status, 401);
  });

  test('recovery codes work once each and can be regenerated with the authenticator', async () => {
    const { secret, recoveryCodes, token } = await enrol(ctx.call, 'lynette@saveman.pg', 'consult123');

    const a = await login(ctx.call, 'lynette@saveman.pg', 'consult123');
    // Lowercase and without the dash still works.
    const used = await ctx.call('POST', '/api/auth/mfa/verify', { recoveryCode: recoveryCodes[0].toLowerCase().replace('-', '') }, a.body.mfaToken);
    assert.equal(used.status, 200);
    assert.equal(used.body.usedRecoveryCode, true);
    assert.equal(used.body.recoveryCodesRemaining, 9);

    const b = await login(ctx.call, 'lynette@saveman.pg', 'consult123');
    const again = await ctx.call('POST', '/api/auth/mfa/verify', { recoveryCode: recoveryCodes[0] }, b.body.mfaToken);
    assert.equal(again.status, 401, 'used recovery code rejected');

    // Regenerating needs a TOTP code, not a recovery code.
    assert.equal((await ctx.call('POST', '/api/mfa/recovery-codes', { recoveryCode: recoveryCodes[1] }, token)).status, 401);
    const regen = await ctx.call('POST', '/api/mfa/recovery-codes', { code: totpAt(secret, clock) }, token);
    assert.equal(regen.status, 200);
    assert.equal(regen.body.recoveryCodes.length, 10);

    tick(30_000);
    const c = await login(ctx.call, 'lynette@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { recoveryCode: recoveryCodes[2] }, c.body.mfaToken)).status, 401, 'old codes invalidated');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { recoveryCode: regen.body.recoveryCodes[0] }, c.body.mfaToken)).status, 200);
  });

  test('admins and consultants cannot disable MFA', async () => {
    const { secret, token } = await enrol(ctx.call, 'kevin@saveman.pg', 'consult123');
    const res = await ctx.call('POST', '/api/mfa/disable', { password: 'consult123', code: totpAt(secret, clock) }, token);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'mfa_required_for_role');
  });

  test('client can turn MFA on and off; off needs password and a code', async () => {
    const session = (await login(ctx.call, 'peter@example.pg', 'client123')).body.token;
    const setup = await ctx.call('POST', '/api/mfa/setup', {}, session);
    const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, session);
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.token, undefined, 'already had a session');
    tick(30_000);

    const res = await login(ctx.call, 'peter@example.pg', 'client123');
    assert.equal(res.body.status, 'mfa_required');
    const s2 = (await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(setup.body.secret, clock) }, res.body.mfaToken)).body.token;
    tick(30_000);

    assert.equal((await ctx.call('POST', '/api/mfa/disable', { password: 'wrong', code: totpAt(setup.body.secret, clock) }, s2)).status, 401);
    assert.equal((await ctx.call('POST', '/api/mfa/disable', { password: 'client123', code: '000001' }, s2)).status, 401);
    const off = await ctx.call('POST', '/api/mfa/disable', { password: 'client123', code: totpAt(setup.body.secret, clock) }, s2);
    assert.equal(off.status, 200);
    assert.equal(off.body.user.mfaEnabled, false);

    // Disabling signs out other devices, keeps this one.
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, session)).status, 401);
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, s2)).body.enabled, false);
    assert.equal((await login(ctx.call, 'peter@example.pg', 'client123')).body.status, 'ok');
    assert.equal((await ctx.db.get('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ?', 'u-client-2')).n, 0);
  });

  test('moving MFA to a new phone needs the password and current code; old one works until confirmed', async () => {
    const { secret, token } = await enrol(ctx.call, 'esther@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/mfa/setup', {}, token)).status, 401, 'no re-auth');
    const setup = await ctx.call('POST', '/api/mfa/setup', { password: 'consult123', code: totpAt(secret, clock) }, token);
    assert.equal(setup.status, 200);
    assert.notEqual(setup.body.secret, secret);
    const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, token);
    assert.equal(enabled.status, 200);
    tick(30_000);

    const res = await login(ctx.call, 'esther@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, res.body.mfaToken)).status, 401, 'old secret retired');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(setup.body.secret, clock) }, res.body.mfaToken)).status, 200);
  });

  test('five wrong codes lock MFA for the account for 15 minutes', async () => {
    const { secret } = await enrol(ctx.call, 'nathan@saveman.pg', 'consult123');
    const res = await login(ctx.call, 'nathan@saveman.pg', 'consult123');
    const wrong = totpAt(secret, clock) === '123456' ? '654321' : '123456';
    for (let i = 0; i < 4; i++) {
      assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: wrong }, res.body.mfaToken)).status, 401);
    }
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: wrong }, res.body.mfaToken)).body.error.code, 'mfa_locked');

    // Locked even with the right code, and a fresh login doesn't reset it.
    const res2 = await login(ctx.call, 'nathan@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, res2.body.mfaToken)).status, 429);

    tick(15 * 60_000 + 1);
    const res3 = await login(ctx.call, 'nathan@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, res3.body.mfaToken)).status, 200);
  });

  test('five wrong passwords lock the login for 15 minutes', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login(ctx.call, 'tony@example.pg', 'bad')).status, 401);
    const locked = await login(ctx.call, 'tony@example.pg', 'client123');
    assert.equal(locked.status, 429);
    assert.equal(locked.body.error.code, 'account_locked');
    tick(15 * 60_000 + 1);
    assert.equal((await login(ctx.call, 'tony@example.pg', 'client123')).status, 200);
  });

  test('sign-up: clients get a session, consultants must enrol, admin sign-up is refused', async () => {
    const base = { name: 'Test Person', password: 'secret1' };
    const client = await ctx.call('POST', '/api/auth/register', { ...base, role: 'client', email: 'new.client@example.pg' });
    assert.equal(client.status, 201);
    assert.equal(client.body.status, 'ok');
    const consultant = await ctx.call('POST', '/api/auth/register', { ...base, role: 'consultant', email: 'new.consultant@example.pg' });
    assert.equal(consultant.body.status, 'mfa_setup_required');
    assert.equal((await ctx.call('POST', '/api/auth/register', { ...base, role: 'admin', email: 'x@example.pg' })).status, 400);
    assert.equal((await ctx.call('POST', '/api/auth/register', { ...base, role: 'client', email: 'NEW.client@example.pg' })).status, 409);
  });

  test('logout revokes the session', async () => {
    const token = (await login(ctx.call, 'john@example.pg', 'client123')).body.token;
    assert.equal((await ctx.call('POST', '/api/auth/logout', null, token)).status, 200);
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, token)).status, 401);
  });
});

test('per-IP rate limit on login', async () => {
  const { server, call } = await startServer({ limits: { auth: 3, mfa: 3 } });
  try {
    for (let i = 0; i < 3; i++) assert.equal((await login(call, 'mary@example.pg', 'client123')).status, 200);
    const limited = await login(call, 'mary@example.pg', 'client123');
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'rate_limited');
  } finally {
    server.close();
  }
});

test('suspended accounts are refused after the password check', async () => {
  const { server, call } = await startServer();
  try {
    const res = await login(call, 'ruth@example.pg', 'client123');
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'account_suspended');
  } finally {
    server.close();
  }
});

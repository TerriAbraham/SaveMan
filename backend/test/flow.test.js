// End-to-end tests over HTTP: login, emailed codes, authenticator apps, recovery, lockouts, password resets.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createApp } from '../src/app.js';
import { deriveKeys } from '../src/config.js';
import { openDb, seedIfEmpty } from '../src/db.js';
import { totpAt } from '../src/totp.js';

let clock = Date.parse('2026-11-07T09:00:00Z');
const tick = (ms) => (clock += ms);

/** Keeps emails instead of sending them. `configured: false` behaves like a server without Brevo. */
function fakeMailer({ configured = true, fail = false } = {}) {
  const sent = [];
  return {
    configured,
    sent,
    async send(message) {
      if (fail) throw new Error('Brevo is down');
      sent.push(message);
    },
  };
}

/** The 6-digit code in the latest email to `to`. */
function emailedCode(mailer, to) {
  const last = mailer.sent.findLast((m) => m.to === to);
  assert.ok(last, `an email was sent to ${to}`);
  return last.text.match(/\b\d{6}\b/)[0];
}

async function startServer(opts = {}) {
  const db = await openDb({ path: ':memory:' });
  await seedIfEmpty(db);
  const mailer = opts.mailer ?? fakeMailer();
  const app = createApp({ db, keys: deriveKeys(randomBytes(32)), mailer, now: () => clock, limits: { auth: 1000, mfa: 1000 }, ...opts });
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
  return { db, server, call, mailer };
}

const login = (call, email, password) => call('POST', '/api/auth/login', { email, password });

/** Logs in with the emailed code. Returns the session token. */
async function emailLogin(ctx, email, password) {
  const res = await login(ctx.call, email, password);
  assert.equal(res.body.status, 'mfa_required');
  const ok = await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: emailedCode(ctx.mailer, email) }, res.body.mfaToken);
  assert.equal(ok.status, 200);
  return ok.body.token;
}

/** Signs in and sets up an authenticator app. Returns the secret, recovery codes and session. */
async function enrol(ctx, email, password) {
  const token = await emailLogin(ctx, email, password);
  const setup = await ctx.call('POST', '/api/mfa/setup', {}, token);
  assert.equal(setup.status, 200);
  const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, token);
  assert.equal(enabled.status, 200);
  tick(30_000); // move past the step just used, as a real user would
  return { secret: setup.body.secret, recoveryCodes: enabled.body.recoveryCodes, token };
}

describe('two-step verification', () => {
  let ctx;
  before(async () => (ctx = await startServer()));
  after(() => ctx.server.close());

  test('client without two-step verification logs straight in; wrong password is rejected generically', async () => {
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

  test('admin is emailed a code after the password; the challenge token is not a session', async () => {
    const res = await login(ctx.call, 'admin@saveman.pg', 'admin123');
    assert.equal(res.body.status, 'mfa_required');
    assert.equal(res.body.token, undefined, 'no session yet');
    assert.deepEqual(res.body.methods, { authenticator: false, email: 'ad•••@saveman.pg' });
    assert.equal(res.body.email.sentTo, 'ad•••@saveman.pg');
    assert.equal(res.body.email.devCode, undefined, 'the code is only in the email');

    const mail = ctx.mailer.sent.at(-1);
    assert.equal(mail.to, 'admin@saveman.pg');
    assert.match(mail.subject, /^Your SaveMan login code: \d{6}$/);
    const code = emailedCode(ctx.mailer, 'admin@saveman.pg');
    assert.ok(mail.html.includes(code));

    const token = res.body.mfaToken;
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, token)).status, 401, 'challenge token is not a session');
    const wrong = await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: code === '000000' ? '111111' : '000000' }, token);
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'invalid_code');

    const ok = await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: code }, token);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.emailMfaEnabled, true);

    // The code is stored only as a keyed hash, and works once.
    assert.equal((await ctx.db.get('SELECT COUNT(*) AS n FROM email_codes WHERE user_id = ?', 'u-admin-1')).n, 0);
    const again = await login(ctx.call, 'admin@saveman.pg', 'admin123');
    tick(30_000);
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: code }, again.body.mfaToken)).status, 401, 'old code rejected');

    const status = await ctx.call('GET', '/api/mfa/status', null, ok.body.token);
    assert.deepEqual(status.body, { enabled: false, emailEnabled: true, required: true, enabledAt: null, recoveryCodesRemaining: 0 });
  });

  test('a new code can be emailed after 30 seconds, and replaces the old one', async () => {
    const res = await login(ctx.call, 'samuel@saveman.pg', 'consult123');
    const first = emailedCode(ctx.mailer, 'samuel@saveman.pg');
    const soon = await ctx.call('POST', '/api/auth/mfa/email', {}, res.body.mfaToken);
    assert.equal(soon.status, 429);
    assert.equal(soon.body.error.code, 'code_recently_sent');

    tick(30_000);
    const resent = await ctx.call('POST', '/api/auth/mfa/email', {}, res.body.mfaToken);
    assert.equal(resent.status, 200);
    const second = emailedCode(ctx.mailer, 'samuel@saveman.pg');
    if (first !== second) {
      assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: first }, res.body.mfaToken)).status, 401, 'old code replaced');
    }
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: second }, res.body.mfaToken)).status, 200);
  });

  test('emailed codes expire after 10 minutes, with the challenge', async () => {
    const res = await login(ctx.call, 'kevin@saveman.pg', 'consult123');
    const code = emailedCode(ctx.mailer, 'kevin@saveman.pg');
    tick(10 * 60_000 + 1);
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: code }, res.body.mfaToken)).status, 401);
  });

  test('login with an authenticator app: no email unless asked; the same code cannot be replayed', async () => {
    const { secret } = await enrol(ctx, 'joanne@saveman.pg', 'consult123');
    const emails = ctx.mailer.sent.length;

    const first = await login(ctx.call, 'joanne@saveman.pg', 'consult123');
    assert.equal(first.body.status, 'mfa_required');
    assert.equal(first.body.methods.authenticator, true);
    assert.equal(first.body.email, undefined);
    assert.equal(ctx.mailer.sent.length, emails, 'no email when the authenticator is set up');
    const code = totpAt(secret, clock);
    const ok = await ctx.call('POST', '/api/auth/mfa/verify', { code }, first.body.mfaToken);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.role, 'consultant');

    const second = await login(ctx.call, 'joanne@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code }, second.body.mfaToken)).status, 401, 'replayed code rejected');

    // Phone not at hand: an emailed code works too.
    assert.equal((await ctx.call('POST', '/api/auth/mfa/email', {}, second.body.mfaToken)).status, 200);
    const next = await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: emailedCode(ctx.mailer, 'joanne@saveman.pg') }, second.body.mfaToken);
    assert.equal(next.status, 200);

    // Challenge tokens are single use and can't be used as sessions.
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, second.body.mfaToken)).status, 401);
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, first.body.mfaToken)).status, 401);
  });

  test('an authenticator code is refused for accounts without one', async () => {
    const res = await login(ctx.call, 'lynette@saveman.pg', 'consult123');
    const r = await ctx.call('POST', '/api/auth/mfa/verify', { code: '123456' }, res.body.mfaToken);
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'invalid_code');
  });

  test('recovery codes work once each and can be regenerated with the authenticator', async () => {
    const { secret, recoveryCodes, token } = await enrol(ctx, 'lynette@saveman.pg', 'consult123');

    const a = await login(ctx.call, 'lynette@saveman.pg', 'consult123');
    // Lowercase and without the dash still works.
    const used = await ctx.call('POST', '/api/auth/mfa/verify', { recoveryCode: recoveryCodes[0].toLowerCase().replace('-', '') }, a.body.mfaToken);
    assert.equal(used.status, 200);
    assert.equal(used.body.usedRecoveryCode, true);
    assert.equal(used.body.recoveryCodesRemaining, 9);

    const b = await login(ctx.call, 'lynette@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { recoveryCode: recoveryCodes[0] }, b.body.mfaToken)).status, 401, 'used recovery code rejected');

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

  test('consultants can remove the authenticator but keep emailed codes, which they cannot turn off', async () => {
    const { secret, token } = await enrol(ctx, 'nathan@saveman.pg', 'consult123');
    const off = await ctx.call('POST', '/api/mfa/disable', { password: 'consult123', code: totpAt(secret, clock) }, token);
    assert.equal(off.status, 200);
    assert.equal(off.body.user.mfaEnabled, false);
    assert.equal(off.body.user.emailMfaEnabled, true);

    const res = await login(ctx.call, 'nathan@saveman.pg', 'consult123');
    assert.equal(res.body.status, 'mfa_required', 'still needs a second step');
    assert.ok(res.body.email.sentTo);

    const refused = await ctx.call('POST', '/api/mfa/email/disable', { password: 'consult123' }, token);
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error.code, 'mfa_required_for_role');
  });

  test('client turns emailed codes on (confirmed by a code) and off (with the password)', async () => {
    const session = (await login(ctx.call, 'peter@example.pg', 'client123')).body.token;
    const start = await ctx.call('POST', '/api/mfa/email/start', {}, session);
    assert.equal(start.status, 200);
    assert.equal(start.body.sentTo, 'pe•••@example.pg');
    assert.match(ctx.mailer.sent.at(-1).subject, /^Confirm your SaveMan email/);
    assert.equal((await ctx.call('POST', '/api/mfa/email/enable', { emailCode: '12345' }, session)).status, 401);
    const on = await ctx.call('POST', '/api/mfa/email/enable', { emailCode: emailedCode(ctx.mailer, 'peter@example.pg') }, session);
    assert.equal(on.status, 200);
    assert.equal(on.body.user.emailMfaEnabled, true);
    assert.equal((await ctx.call('POST', '/api/mfa/email/start', {}, session)).status, 400, 'already on');

    const s2 = await emailLogin(ctx, 'peter@example.pg', 'client123');

    assert.equal((await ctx.call('POST', '/api/mfa/email/disable', { password: 'wrong' }, s2)).status, 401);
    const off = await ctx.call('POST', '/api/mfa/email/disable', { password: 'client123' }, s2);
    assert.equal(off.status, 200);
    assert.equal(off.body.user.emailMfaEnabled, false);
    assert.equal((await login(ctx.call, 'peter@example.pg', 'client123')).body.status, 'ok');
  });

  test('client can turn the authenticator on and off; off needs password and a code', async () => {
    const session = (await login(ctx.call, 'mary@example.pg', 'client123')).body.token;
    const setup = await ctx.call('POST', '/api/mfa/setup', {}, session);
    const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, session);
    assert.equal(enabled.status, 200);
    tick(30_000);

    const res = await login(ctx.call, 'mary@example.pg', 'client123');
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
    assert.equal((await login(ctx.call, 'mary@example.pg', 'client123')).body.status, 'ok');
  });

  test('moving the authenticator to a new phone needs the password and current code', async () => {
    const { secret, token } = await enrol(ctx, 'esther@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/mfa/setup', {}, token)).status, 401, 'no re-auth');
    const setup = await ctx.call('POST', '/api/mfa/setup', { password: 'consult123', code: totpAt(secret, clock) }, token);
    assert.equal(setup.status, 200);
    const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, clock) }, token);
    assert.equal(enabled.status, 200);
    tick(30_000);

    const res = await login(ctx.call, 'esther@saveman.pg', 'consult123');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(secret, clock) }, res.body.mfaToken)).status, 401, 'old secret retired');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { code: totpAt(setup.body.secret, clock) }, res.body.mfaToken)).status, 200);
  });

  test('five wrong codes lock two-step verification for the account for 15 minutes', async () => {
    const res = await login(ctx.call, 'consultant@saveman.pg', 'consult123');
    const right = emailedCode(ctx.mailer, 'consultant@saveman.pg');
    const wrong = right === '123456' ? '654321' : '123456';
    for (let i = 0; i < 4; i++) {
      assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: wrong }, res.body.mfaToken)).status, 401);
    }
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: wrong }, res.body.mfaToken)).body.error.code, 'mfa_locked');

    // Locked even with a fresh login and a fresh code.
    tick(30_000);
    const res2 = await login(ctx.call, 'consultant@saveman.pg', 'consult123');
    const fresh = emailedCode(ctx.mailer, 'consultant@saveman.pg');
    assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: fresh }, res2.body.mfaToken)).status, 429);

    tick(15 * 60_000 + 1);
    await emailLogin(ctx, 'consultant@saveman.pg', 'consult123');
  });

  test('five wrong passwords lock the login for 15 minutes', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login(ctx.call, 'tony@example.pg', 'bad')).status, 401);
    const locked = await login(ctx.call, 'tony@example.pg', 'client123');
    assert.equal(locked.status, 429);
    assert.equal(locked.body.error.code, 'account_locked');
    tick(15 * 60_000 + 1);
    assert.equal((await login(ctx.call, 'tony@example.pg', 'client123')).status, 200);
  });

  test('sign-up: clients get a session, consultants are emailed a code, admin sign-up is refused', async () => {
    const base = { name: 'Test Person', password: 'secret1' };
    const client = await ctx.call('POST', '/api/auth/register', { ...base, role: 'client', email: 'new.client@example.pg' });
    assert.equal(client.status, 201);
    assert.equal(client.body.status, 'ok');
    const consultant = await ctx.call('POST', '/api/auth/register', { ...base, role: 'consultant', email: 'new.consultant@example.pg' });
    assert.equal(consultant.body.status, 'mfa_required');
    const ok = await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: emailedCode(ctx.mailer, 'new.consultant@example.pg') }, consultant.body.mfaToken);
    assert.equal(ok.status, 200);
    assert.equal((await ctx.call('POST', '/api/auth/register', { ...base, role: 'admin', email: 'x@example.pg' })).status, 400);
    assert.equal((await ctx.call('POST', '/api/auth/register', { ...base, role: 'client', email: 'NEW.client@example.pg' })).status, 409);
  });

  test('logout revokes the session', async () => {
    const token = (await login(ctx.call, 'john@example.pg', 'client123')).body.token;
    assert.equal((await ctx.call('POST', '/api/auth/logout', null, token)).status, 200);
    assert.equal((await ctx.call('GET', '/api/mfa/status', null, token)).status, 401);
  });
});

describe('forgotten password by email', () => {
  let ctx;
  before(async () => (ctx = await startServer()));
  after(() => ctx.server.close());

  const request = (email) => ctx.call('POST', '/api/auth/password-reset/request', { email });
  const reset = (body) => ctx.call('POST', '/api/auth/password-reset', { email: 'helen@example.pg', newPassword: 'brand-new', ...body });

  test('the emailed code sets a new password once and signs out every device', async () => {
    const old = (await login(ctx.call, 'helen@example.pg', 'client123')).body.token;
    const res = await request('Helen@Example.pg');
    assert.deepEqual(res.body, { ok: true });
    const mail = ctx.mailer.sent.at(-1);
    assert.equal(mail.to, 'helen@example.pg');
    assert.match(mail.subject, /^Reset your SaveMan password: \d{6}$/);
    const code = emailedCode(ctx.mailer, 'helen@example.pg');

    assert.equal((await reset({ emailCode: code === '000000' ? '111111' : '000000' })).status, 401);
    assert.equal((await reset({ emailCode: code, newPassword: '123' })).status, 400, 'still needs a strong password');
    assert.equal((await reset({ emailCode: code })).status, 200);
    assert.equal((await reset({ emailCode: code, newPassword: 'another1' })).status, 401, 'used once only');

    assert.equal((await ctx.call('GET', '/api/auth/me', null, old)).status, 401, 'signed out everywhere');
    assert.equal((await login(ctx.call, 'helen@example.pg', 'client123')).status, 401);
    assert.equal((await login(ctx.call, 'helen@example.pg', 'brand-new')).body.status, 'ok');
  });

  test('unknown and suspended emails get the same reply and no email', async () => {
    const before = ctx.mailer.sent.length;
    const unknown = await request('nobody@example.pg');
    const suspended = await request('ruth@example.pg');
    assert.deepEqual(unknown.body, { ok: true });
    assert.deepEqual(suspended.body, { ok: true });
    assert.equal(ctx.mailer.sent.length, before);
    assert.equal((await request('not-an-email')).status, 400);
  });

  test('asking again within 30 seconds sends nothing new but looks the same', async () => {
    await request('john@example.pg');
    const first = emailedCode(ctx.mailer, 'john@example.pg');
    const count = ctx.mailer.sent.length;
    assert.deepEqual((await request('john@example.pg')).body, { ok: true });
    assert.equal(ctx.mailer.sent.length, count);
    const r = await ctx.call('POST', '/api/auth/password-reset', { email: 'john@example.pg', newPassword: 'brand-new', emailCode: first });
    assert.equal(r.status, 200);
  });

  test('five wrong guesses use the code up', async () => {
    await request('tony@example.pg');
    const code = emailedCode(ctx.mailer, 'tony@example.pg');
    const wrong = code === '123456' ? '654321' : '123456';
    const attempt = (emailCode) => ctx.call('POST', '/api/auth/password-reset', { email: 'tony@example.pg', newPassword: 'brand-new', emailCode });
    for (let i = 0; i < 5; i++) assert.equal((await attempt(wrong)).status, 401);
    assert.equal((await attempt(code)).status, 401);
  });
});

describe('without email set up', () => {
  test('in development, codes are shown in the app so it can still be used', async () => {
    const ctx = await startServer({ mailer: fakeMailer({ configured: false }) });
    try {
      const res = await login(ctx.call, 'admin@saveman.pg', 'admin123');
      assert.match(res.body.email.devCode, /^\d{6}$/);
      assert.equal((await ctx.call('POST', '/api/auth/mfa/verify', { emailCode: res.body.email.devCode }, res.body.mfaToken)).status, 200);
      const reset = await ctx.call('POST', '/api/auth/password-reset/request', { email: 'client@saveman.pg' });
      assert.match(reset.body.devCode, /^\d{6}$/);
      assert.equal((await ctx.call('GET', '/api/health')).body.email, 'not_configured');
    } finally {
      ctx.server.close();
    }
  });

  test('in production, login codes are still shown but password resets are refused', async () => {
    const ctx = await startServer({ mailer: fakeMailer({ configured: false }), production: true });
    try {
      const res = await login(ctx.call, 'admin@saveman.pg', 'admin123');
      assert.match(res.body.email.devCode, /^\d{6}$/, 'needs the password first, so admins aren’t locked out');
      const reset = await ctx.call('POST', '/api/auth/password-reset/request', { email: 'client@saveman.pg' });
      assert.equal(reset.status, 503);
      assert.equal(reset.body.error.code, 'email_not_configured');
    } finally {
      ctx.server.close();
    }
  });

  test('when sending fails, login still reaches the code step and says so', async () => {
    const ctx = await startServer({ mailer: fakeMailer({ fail: true }) });
    try {
      const res = await login(ctx.call, 'admin@saveman.pg', 'admin123');
      assert.equal(res.body.status, 'mfa_required');
      assert.match(res.body.emailError, /couldn’t send/);
      assert.equal((await ctx.call('POST', '/api/auth/mfa/email', {}, res.body.mfaToken)).status, 502);
      assert.equal((await ctx.call('POST', '/api/auth/password-reset/request', { email: 'client@saveman.pg' })).status, 502);
    } finally {
      ctx.server.close();
    }
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

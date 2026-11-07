// REST routes for the app's data: CRUD with GET/POST/PATCH/DELETE, and role-based authorization.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { getSlots, worksOn } from '../../src/utils/availability.ts';
import { addDays, toISODate } from '../../src/utils/dates.ts';
import { createApp } from '../src/app.js';
import { deriveKeys } from '../src/config.js';
import { openDb, seedIfEmpty } from '../src/db.js';
import { totpAt } from '../src/totp.js';

let ctx;
const tokens = {};

async function startServer() {
  const db = await openDb({ path: ':memory:' });
  await seedIfEmpty(db);
  // Real clock: the dummy bookings are dated relative to today.
  const app = createApp({ db, keys: deriveKeys(randomBytes(32)), limits: { auth: 1000, mfa: 1000 } });
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
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  }
  return { db, server, call };
}

/** A session for a demo account; consultants and admins enrol in MFA first. */
async function sessionFor(email, password) {
  const res = await ctx.call('POST', '/api/auth/login', { email, password });
  if (res.body.status === 'ok') return res.body.token;
  const setup = await ctx.call('POST', '/api/mfa/setup', {}, res.body.mfaToken);
  const enabled = await ctx.call('POST', '/api/mfa/enable', { code: totpAt(setup.body.secret, Date.now()) }, res.body.mfaToken);
  return enabled.body.token;
}

/** A free slot with this consultant at least a week ahead, as the booking screen would offer. */
function freeSlot(consultant, bookings) {
  for (let d = 7; d < 60; d++) {
    const date = toISODate(addDays(new Date(), d));
    if (!worksOn(consultant, date)) continue;
    const slot = getSlots(consultant, date, consultant.services[0].durationMins, bookings).find((s) => s.available);
    if (slot) return { date, time: slot.time };
  }
  throw new Error('no free slot');
}

before(async () => {
  ctx = await startServer();
  tokens.client = await sessionFor('client@saveman.pg', 'client123');
  tokens.consultant = await sessionFor('consultant@saveman.pg', 'consult123');
  tokens.admin = await sessionFor('admin@saveman.pg', 'admin123');
});
after(() => ctx.server.close());

describe('public reads', () => {
  test('categories, consultants and reviews can be read without logging in', async () => {
    const categories = await ctx.call('GET', '/api/categories');
    assert.equal(categories.status, 200);
    assert.ok(categories.body.length >= 10);

    const users = await ctx.call('GET', '/api/users');
    assert.equal(users.status, 200);
    assert.ok(users.body.every((u) => u.role !== 'admin' && u.email === '' && u.password === ''), 'no admins, emails or passwords');
    assert.ok(users.body.filter((u) => u.role === 'consultant').every((u) => u.verification === 'verified'));

    const reviews = await ctx.call('GET', '/api/reviews');
    assert.ok(reviews.body.every((r) => !r.removedAt));
  });

  test('data routes that change things need a session', async () => {
    assert.equal((await ctx.call('GET', '/api/bookings')).status, 401);
    assert.equal((await ctx.call('POST', '/api/categories', { name: 'Hacking' })).status, 401);
    assert.equal((await ctx.call('DELETE', '/api/categories/cat-it')).status, 401);
  });

  test('GET /api/auth/me returns the signed-in profile', async () => {
    const me = await ctx.call('GET', '/api/auth/me', null, tokens.consultant);
    assert.equal(me.status, 200);
    assert.equal(me.body.email, 'consultant@saveman.pg');
    assert.equal(me.body.role, 'consultant');
    assert.ok(Array.isArray(me.body.services));
  });
});

describe('categories: admin-only CRUD', () => {
  test('admin creates, renames and deletes a category', async () => {
    const created = await ctx.call('POST', '/api/categories', { name: 'Fisheries', description: 'Fishing licences and exports' }, tokens.admin);
    assert.equal(created.status, 201);
    const id = created.body.id;

    const renamed = await ctx.call('PATCH', `/api/categories/${id}`, { name: 'Fisheries & Marine' }, tokens.admin);
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.name, 'Fisheries & Marine');
    assert.equal(renamed.body.description, 'Fishing licences and exports', 'PATCH keeps fields it was not sent');

    assert.equal((await ctx.call('DELETE', `/api/categories/${id}`, null, tokens.admin)).status, 204);
    assert.ok(!(await ctx.call('GET', '/api/categories')).body.some((c) => c.id === id));
  });

  test('clients and consultants are refused; duplicates and in-use categories are rejected', async () => {
    assert.equal((await ctx.call('POST', '/api/categories', { name: 'Mine' }, tokens.client)).status, 403);
    assert.equal((await ctx.call('PATCH', '/api/categories/cat-it', { name: 'Mine' }, tokens.consultant)).status, 403);
    assert.equal((await ctx.call('POST', '/api/categories', { name: 'legal' }, tokens.admin)).status, 400);
    const me = await ctx.call('GET', '/api/auth/me', null, tokens.consultant);
    const inUse = await ctx.call('DELETE', `/api/categories/${me.body.categoryId}`, null, tokens.admin);
    assert.equal(inUse.status, 409);
  });
});

describe('services: a consultant manages their own', () => {
  test('consultant adds, edits and deletes a service', async () => {
    const added = await ctx.call('POST', '/api/services', { name: 'Quick check-in call', description: '', durationMins: 30, price: 80 }, tokens.consultant);
    assert.equal(added.status, 201);
    const id = added.body.service.id;

    const edited = await ctx.call('PATCH', `/api/services/${id}`, { price: 95 }, tokens.consultant);
    assert.equal(edited.status, 200);
    assert.equal(edited.body.service.price, 95);
    assert.equal(edited.body.service.name, 'Quick check-in call');

    const removed = await ctx.call('DELETE', `/api/services/${id}`, null, tokens.consultant);
    assert.equal(removed.status, 200);
    assert.ok(!removed.body.user.services.some((s) => s.id === id));
  });

  test('other roles are refused and bad input is rejected', async () => {
    assert.equal((await ctx.call('POST', '/api/services', { name: 'Fake', durationMins: 60, price: 10 }, tokens.client)).status, 403);
    assert.equal((await ctx.call('POST', '/api/services', { name: 'Free', durationMins: 60, price: 0 }, tokens.consultant)).status, 400);
    assert.equal((await ctx.call('POST', '/api/services', { name: 'Odd length', durationMins: 45, price: 100 }, tokens.consultant)).status, 400);
    assert.equal((await ctx.call('DELETE', '/api/services/s-does-not-exist', null, tokens.consultant)).status, 404);
  });
});

describe('bookings', () => {
  let booking;

  test('client books a free slot; consultant sees and accepts it', async () => {
    const consultant = (await ctx.call('GET', '/api/auth/me', null, tokens.consultant)).body;
    const theirs = (await ctx.call('GET', '/api/bookings', null, tokens.consultant)).body;
    const slot = freeSlot(consultant, theirs);
    const res = await ctx.call(
      'POST',
      '/api/bookings',
      { consultantId: consultant.id, serviceId: consultant.services[0].id, ...slot, mode: 'video', note: 'Test booking' },
      tokens.client,
    );
    assert.equal(res.status, 201);
    booking = res.body;
    assert.equal(booking.status, 'pending');
    assert.equal(booking.price, consultant.services[0].price);

    const again = await ctx.call('POST', '/api/bookings', { consultantId: consultant.id, serviceId: consultant.services[0].id, ...slot, mode: 'video' }, tokens.client);
    assert.equal(again.status, 409, 'the same slot can’t be booked twice');

    assert.ok((await ctx.call('GET', '/api/bookings', null, tokens.consultant)).body.some((b) => b.id === booking.id));
    const busy = (await ctx.call('GET', `/api/users/${consultant.id}/busy`, null, tokens.client)).body;
    assert.ok(busy.some((b) => b.date === slot.date && b.time === slot.time), 'other clients see the slot as busy');
    assert.ok(busy.every((b) => !('clientId' in b) && !('note' in b)), 'no client details');
    const accepted = await ctx.call('PATCH', `/api/bookings/${booking.id}`, { status: 'confirmed' }, tokens.consultant);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, 'confirmed');
  });

  test('each role may only make its own changes', async () => {
    assert.equal((await ctx.call('PATCH', `/api/bookings/${booking.id}`, { status: 'completed' }, tokens.client)).status, 403);
    assert.equal((await ctx.call('PATCH', `/api/bookings/${booking.id}`, { status: 'cancelled' }, tokens.consultant)).status, 403);
    assert.equal((await ctx.call('PATCH', `/api/bookings/${booking.id}`, { status: 'cancelled' }, tokens.admin)).status, 403);
    assert.equal((await ctx.call('POST', '/api/bookings', {}, tokens.consultant)).status, 403, 'only clients book');
    const completedEarly = await ctx.call('PATCH', `/api/bookings/${booking.id}`, { status: 'completed' }, tokens.consultant);
    assert.equal(completedEarly.status, 409, 'not before the session starts');
  });

  test('client cancels; admin sees every booking; others can’t see it', async () => {
    const cancelled = await ctx.call('PATCH', `/api/bookings/${booking.id}`, { status: 'cancelled' }, tokens.client);
    assert.equal(cancelled.body.status, 'cancelled');
    const all = (await ctx.call('GET', '/api/bookings', null, tokens.admin)).body;
    assert.ok(all.length > (await ctx.call('GET', '/api/bookings', null, tokens.client)).body.length);

    const other = await sessionFor('peter@example.pg', 'client123');
    assert.equal((await ctx.call('GET', `/api/bookings/${booking.id}`, null, other)).status, 404, 'another client’s booking');
  });
});

describe('reviews', () => {
  test('client reviews a completed booking once; admin removes and restores it', async () => {
    const mine = (await ctx.call('GET', '/api/bookings', null, tokens.client)).body;
    const reviewed = new Set((await ctx.call('GET', '/api/reviews', null, tokens.client)).body.map((r) => r.bookingId));
    const target = mine.find((b) => b.status === 'completed' && !reviewed.has(b.id));
    assert.ok(target, 'demo data has a completed, unreviewed booking');

    const before = (await ctx.call('GET', `/api/users/${target.consultantId}`)).body.reviewCount;
    const created = await ctx.call('POST', '/api/reviews', { bookingId: target.id, rating: 5, comment: 'Very helpful.' }, tokens.client);
    assert.equal(created.status, 201);
    assert.equal((await ctx.call('GET', `/api/users/${target.consultantId}`)).body.reviewCount, before + 1);
    assert.equal((await ctx.call('POST', '/api/reviews', { bookingId: target.id, rating: 4 }, tokens.client)).status, 409);

    assert.equal((await ctx.call('PATCH', `/api/reviews/${created.body.id}`, { removed: true }, tokens.client)).status, 403);
    const removed = await ctx.call('PATCH', `/api/reviews/${created.body.id}`, { removed: true }, tokens.admin);
    assert.ok(removed.body.removedAt);
    assert.ok(!(await ctx.call('GET', '/api/reviews')).body.some((r) => r.id === created.body.id), 'hidden from the public');
    assert.equal((await ctx.call('PATCH', `/api/reviews/${created.body.id}`, { removed: false }, tokens.admin)).status, 200);
  });
});

describe('messages', () => {
  test('client and consultant message each other and mark a conversation read', async () => {
    const consultant = (await ctx.call('GET', '/api/auth/me', null, tokens.consultant)).body;
    const sent = await ctx.call('POST', '/api/messages', { recipientId: consultant.id, text: 'Hello, are you free next week?' }, tokens.client);
    assert.equal(sent.status, 201);
    const { conversation, message } = sent.body;

    const inbox = (await ctx.call('GET', `/api/messages?conversationId=${conversation.id}`, null, tokens.consultant)).body;
    assert.ok(inbox.some((m) => m.id === message.id && !m.read));
    assert.equal((await ctx.call('PATCH', `/api/conversations/${conversation.id}`, { read: true }, tokens.consultant)).status, 200);
    const after = (await ctx.call('GET', `/api/messages?conversationId=${conversation.id}`, null, tokens.client)).body;
    assert.ok(after.find((m) => m.id === message.id).read);
  });

  test('only client-consultant pairs, and only your own conversations', async () => {
    const me = (await ctx.call('GET', '/api/auth/me', null, tokens.client)).body;
    const users = (await ctx.call('GET', '/api/users', null, tokens.admin)).body;
    const otherClient = users.find((u) => u.role === 'client' && u.id !== me.id);
    assert.equal((await ctx.call('POST', '/api/messages', { recipientId: otherClient.id, text: 'hi' }, tokens.client)).status, 403);
    assert.equal((await ctx.call('POST', '/api/messages', { recipientId: me.id, text: 'hi' }, tokens.admin)).status, 403);
    const adminConversations = (await ctx.call('GET', '/api/conversations', null, tokens.admin)).body;
    assert.deepEqual(adminConversations, []);
  });
});

describe('users: own profile and admin actions', () => {
  test('a user edits their own profile but not someone else’s', async () => {
    const me = (await ctx.call('GET', '/api/auth/me', null, tokens.client)).body;
    const updated = await ctx.call('PATCH', `/api/users/${me.id}`, { phone: '+675 7999 0000', city: 'Lae' }, tokens.client);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.city, 'Lae');

    const consultant = (await ctx.call('GET', '/api/auth/me', null, tokens.consultant)).body;
    assert.equal((await ctx.call('PATCH', `/api/users/${consultant.id}`, { name: 'Hacked' }, tokens.client)).status, 403);
    assert.equal((await ctx.call('PATCH', `/api/users/${me.id}`, { status: 'active' }, tokens.client)).status, 403);
    assert.equal((await ctx.call('PATCH', `/api/users/${me.id}`, { hourlyRate: 500 }, tokens.client)).status, 403);
    const rate = await ctx.call('PATCH', `/api/users/${consultant.id}`, { hourlyRate: 350 }, tokens.consultant);
    assert.equal(rate.body.hourlyRate, 350);
  });

  test('admin verifies consultants and suspends accounts, which signs them out', async () => {
    const users = (await ctx.call('GET', '/api/users', null, tokens.admin)).body;
    const pending = users.find((u) => u.role === 'consultant' && u.verification === 'pending');
    if (pending) {
      const verified = await ctx.call('PATCH', `/api/users/${pending.id}`, { verification: 'verified' }, tokens.admin);
      assert.equal(verified.body.verification, 'verified');
    }
    const me = (await ctx.call('GET', '/api/auth/me', null, tokens.client)).body;
    assert.equal((await ctx.call('PATCH', `/api/users/${me.id}`, { status: 'suspended' }, tokens.consultant)).status, 403);
    assert.equal((await ctx.call('PATCH', `/api/users/${me.id}`, { status: 'suspended' }, tokens.admin)).status, 200);
    assert.equal((await ctx.call('GET', '/api/bookings', null, tokens.client)).status, 401, 'suspension ends their sessions');
    const login = await ctx.call('POST', '/api/auth/login', { email: 'client@saveman.pg', password: 'client123' });
    assert.equal(login.status, 403);

    assert.equal((await ctx.call('PATCH', `/api/users/${me.id}`, { status: 'active' }, tokens.admin)).status, 200);
    const admin = users.find((u) => u.role === 'admin');
    assert.equal((await ctx.call('PATCH', `/api/users/${admin.id}`, { status: 'suspended' }, tokens.admin)).status, 403);
  });
});

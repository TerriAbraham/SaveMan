/**
 * REST routes for the app's data: users, services, categories, bookings, reviews, conversations
 * and messages. GET reads, POST creates, PATCH changes part of a record, DELETE removes it.
 * Every route checks the caller's role (and that the record is theirs) on the server, using the
 * same booking and validation rules as the app (imported from ../src).
 */
import { randomUUID } from 'node:crypto';

import { getSlots, isUpcoming, normalizeAvailability, validateAvailability } from '../../src/utils/availability.ts';
import { canAccept, canComplete, canDecline, hasStarted } from '../../src/utils/booking-rules.ts';
import { validateCategory } from '../../src/utils/categories.ts';
import { toISODate, toLocalDateTime } from '../../src/utils/dates.ts';
import { adjustAverage } from '../../src/utils/ratings.ts';
import { DURATION_OPTIONS, validateService } from '../../src/utils/services.ts';
import { sql } from './db.js';
import { ApiError, forbidden, invalid, notFound, str } from './http.js';
import { newProfile, profileOf, toUser } from './profiles.js';

const newId = (prefix) => `${prefix}-${randomUUID().slice(0, 13)}`;
const firstError = (errors) => Object.values(errors).find(Boolean);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MODES = ['in-person', 'video', 'phone'];
const MAX_PHOTO_BYTES = 300 * 1024;

const toBooking = (r) => ({
  id: r.id,
  clientId: r.client_id,
  consultantId: r.consultant_id,
  serviceName: r.service_name,
  date: r.date,
  time: r.time,
  durationMins: r.duration_mins,
  mode: r.mode,
  note: r.note,
  status: r.status,
  price: r.price,
});
const toReview = (r) => ({
  id: r.id,
  bookingId: r.booking_id,
  clientId: r.client_id,
  consultantId: r.consultant_id,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.created_at,
  ...(r.removed_at && { removedAt: r.removed_at }),
});
const toConversation = (r) => ({ id: r.id, clientId: r.client_id, consultantId: r.consultant_id });
const toMessage = (r) => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, text: r.text, sentAt: r.sent_at, read: !!r.read });

/**
 * @param {import('express').Express} app
 * @param {object} deps
 * @param {Awaited<ReturnType<typeof import('./db.js').openDb>>} deps.db
 * @param {(...kinds: string[]) => import('express').RequestHandler} deps.auth signed-in users only
 * @param {import('express').RequestHandler} deps.optionalAuth sets req.auth when a valid session is sent
 * @param {() => number} deps.now
 */
export function registerResources(app, { db, auth, optionalAuth, now }) {
  const signedIn = auth('session');
  /** Role-based authorization: only these roles may call the route. Use after `signedIn`. */
  const allow =
    (...roles) =>
    (req, _res, next) => {
      if (!roles.includes(req.auth.user.role)) throw forbidden();
      next();
    };
  const nowDate = () => new Date(now());

  // ---- Users ---------------------------------------------------------------------------------

  async function loadUsers(where = '', ...args) {
    const rows = await db.all(`SELECT u.*, p.data FROM users u LEFT JOIN profiles p ON p.user_id = u.id ${where}`, ...args);
    return rows.map((r) => toUser(r, r.data ? JSON.parse(r.data) : newProfile(r.role, {}, r.created_at)));
  }
  const loadUser = async (id) => (await loadUsers('WHERE u.id = ?', id))[0];
  const saveProfile = (user) =>
    sql(
      'INSERT INTO profiles (user_id, data) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data',
      user.id,
      JSON.stringify(profileOf(user)),
    );
  const bookable = (u) => u.role === 'consultant' && u.verification === 'verified' && u.status === 'active';

  /**
   * Who the caller may see. Admins: everyone. Others: bookable consultants, clients who wrote a
   * visible review (for their name), people they have a booking or conversation with, and
   * themselves. Other people's email is hidden, and a client's phone only shows to their consultants.
   */
  async function visibleUsers(viewer) {
    const all = await loadUsers();
    if (viewer?.role === 'admin') return all;
    const related = new Set();
    if (viewer) {
      const pairs = await db.all(
        `SELECT client_id, consultant_id FROM bookings WHERE client_id = ?1 OR consultant_id = ?1
         UNION SELECT client_id, consultant_id FROM conversations WHERE client_id = ?1 OR consultant_id = ?1`,
        viewer.id,
      );
      for (const p of pairs) related.add(p.client_id).add(p.consultant_id);
    }
    const reviewers = new Set((await db.all('SELECT DISTINCT client_id FROM reviews WHERE removed_at IS NULL')).map((r) => r.client_id));
    return all
      .filter((u) => u.id === viewer?.id || related.has(u.id) || bookable(u) || (u.role === 'client' && reviewers.has(u.id)))
      .map((u) =>
        u.id === viewer?.id ? u : { ...u, email: '', phone: u.role === 'consultant' || related.has(u.id) ? u.phone : '' },
      );
  }

  app.get('/api/users', optionalAuth, async (req, res) => {
    res.json(await visibleUsers(req.auth?.user));
  });

  app.get('/api/users/:id', optionalAuth, async (req, res) => {
    const user = (await visibleUsers(req.auth?.user)).find((u) => u.id === req.params.id);
    if (!user) throw notFound('User');
    res.json(user);
  });

  /**
   * Your own profile (name, phone, photo, city; a consultant's title, bio, rate, location,
   * qualifications, availability), or, for an admin, another user's status or verification.
   */
  app.patch('/api/users/:id', signedIn, async (req, res) => {
    const viewer = req.auth.user;
    const target = await loadUser(req.params.id);
    if (!target) throw notFound('User');
    const body = req.body ?? {};
    const updated = { ...target };
    const self = target.id === viewer.id;

    if (!self) {
      if (viewer.role !== 'admin') throw forbidden('You can only change your own profile.');
      const keys = Object.keys(body);
      if (keys.length === 0 || keys.some((k) => k !== 'status' && k !== 'verification')) {
        throw invalid('Administrators can change a user’s status or a consultant’s verification.');
      }
      if ('status' in body) {
        if (!['active', 'suspended'].includes(body.status)) throw invalid('Status must be active or suspended.');
        if (target.role === 'admin') throw forbidden('Administrator accounts can’t be suspended here.');
        updated.status = body.status;
      }
      if ('verification' in body) {
        if (target.role !== 'consultant') throw invalid('Only consultants are verified.');
        if (!['pending', 'verified', 'rejected'].includes(body.verification)) throw invalid('Choose pending, verified or rejected.');
        updated.verification = body.verification;
      }
      const statements = [saveProfile(updated), sql('UPDATE users SET status = ? WHERE id = ?', updated.status, target.id)];
      // A suspended user is signed out everywhere.
      if (updated.status === 'suspended') statements.push(sql('DELETE FROM tokens WHERE user_id = ?', target.id));
      await db.batch(statements);
      return res.json(updated);
    }

    if ('status' in body || 'verification' in body) throw forbidden('You can’t change your own status or verification.');
    if ('name' in body) {
      const name = str(body.name, 100).trim();
      if (name.length < 2) throw invalid('Enter your full name.');
      updated.name = name;
    }
    if ('phone' in body) {
      const phone = str(body.phone, 30).trim();
      if (phone.replace(/\D/g, '').length < 7) throw invalid('Enter a valid phone number.');
      updated.phone = phone;
    }
    // New photos are uploaded with POST /api/users/:id/photo; here one can only be removed.
    if ('avatarUri' in body) {
      if (body.avatarUri === null) delete updated.avatarUri;
      else if (body.avatarUri !== target.avatarUri) throw invalid('Choose the photo again to upload it.');
    }
    if ('city' in body) {
      if (target.role !== 'client') throw invalid('Consultants set their town with their location.');
      updated.city = str(body.city, 60);
    }
    const consultantFields = ['title', 'categoryId', 'bio', 'hourlyRate', 'location', 'qualifications', 'availability'];
    if (consultantFields.some((k) => k in body)) {
      if (target.role !== 'consultant') throw forbidden('Only consultants have these details.');
      if ('title' in body) {
        const title = str(body.title, 100).trim();
        if (title.length < 3) throw invalid('Enter your professional title.');
        updated.title = title;
      }
      if ('categoryId' in body) {
        if (!(await db.get('SELECT id FROM categories WHERE id = ?', str(body.categoryId)))) throw invalid('Choose your area of expertise.');
        updated.categoryId = body.categoryId;
      }
      if ('bio' in body) updated.bio = str(body.bio, 2000).trim();
      if ('hourlyRate' in body) {
        if (!Number.isInteger(body.hourlyRate) || body.hourlyRate <= 0 || body.hourlyRate > 100000) throw invalid('Enter a whole number of Kina, e.g. 200.');
        updated.hourlyRate = body.hourlyRate;
      }
      if ('location' in body) {
        const l = body.location ?? {};
        if (![l.latitude, l.longitude].every(Number.isFinite) || !str(l.city, 60) || !str(l.province, 60)) throw invalid('Choose your location on the map.');
        updated.location = { city: l.city, province: l.province, latitude: l.latitude, longitude: l.longitude, address: str(l.address, 200).trim() };
      }
      if ('qualifications' in body) {
        const list = Array.isArray(body.qualifications) ? body.qualifications : null;
        if (!list || list.length > 20) throw invalid('Add up to 20 qualifications.');
        updated.qualifications = list.map((q) => {
          if (!str(q?.name, 120).trim() || !str(q?.issuer, 120).trim() || !Number.isInteger(q?.year)) throw invalid('Each qualification needs a name, issuer and year.');
          const licenceNumber = str(q.licenceNumber, 60).trim();
          return { id: str(q.id, 60) || newId('q'), name: q.name.trim(), issuer: q.issuer.trim(), year: q.year, ...(licenceNumber && { licenceNumber }) };
        });
      }
      if ('availability' in body) {
        const week = body.availability;
        if (!week || typeof week !== 'object') throw invalid('Set your working hours.');
        const error = firstError(validateAvailability(week));
        if (error) throw invalid(error);
        updated.availability = normalizeAvailability(week);
      }
    }
    await db.batch([
      saveProfile(updated),
      sql('UPDATE users SET name = ? WHERE id = ?', updated.name, target.id),
      ...(target.avatarUri && !updated.avatarUri ? [sql('DELETE FROM photos WHERE user_id = ?', target.id)] : []),
    ]);
    res.json(updated);
  });

  // ---- Profile photos ------------------------------------------------------------------------

  /** JPEG or PNG, from the first bytes of the file. */
  const photoType = (data) =>
    data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      ? 'image/jpeg'
      : data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
        ? 'image/png'
        : null;

  /** Your profile photo, as base64 (the app shrinks it first). Replaces the old one. */
  app.post('/api/users/:id/photo', signedIn, async (req, res) => {
    const target = await loadUser(req.params.id);
    if (!target) throw notFound('User');
    if (target.id !== req.auth.user.id) throw forbidden('You can only change your own photo.');
    const image = str(req.body?.image, 600_000);
    if (!image) throw invalid('That photo is too large. Choose a smaller one.');
    const data = Buffer.from(image, 'base64');
    const mime = photoType(data);
    if (!mime) throw invalid('Choose a JPEG or PNG photo.');
    if (data.length > MAX_PHOTO_BYTES) throw invalid('That photo is too large. Choose a smaller one.');

    const id = randomUUID();
    const updated = { ...target, avatarUri: `/api/photos/${id}` };
    await db.batch([
      sql('DELETE FROM photos WHERE user_id = ?', target.id),
      sql('INSERT INTO photos (id, user_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?)', id, target.id, mime, data, now()),
      saveProfile(updated),
    ]);
    res.status(201).json(updated);
  });

  app.get('/api/photos/:id', async (req, res) => {
    const photo = await db.get('SELECT mime, data FROM photos WHERE id = ?', str(req.params.id, 60));
    if (!photo) throw notFound('Photo');
    // Each photo has its own address and never changes, so phones can keep it.
    res.set({ 'Content-Type': photo.mime, 'Cache-Control': 'public, max-age=31536000, immutable' }).send(Buffer.from(photo.data));
  });

  // ---- Services (a consultant's own price list) ------------------------------------------------

  app.get('/api/services', optionalAuth, async (req, res) => {
    const consultantId = str(req.query.consultantId) || (req.auth?.user.role === 'consultant' ? req.auth.user.id : '');
    if (!consultantId) throw invalid('Add ?consultantId=… to choose whose services to list.');
    const consultant = (await visibleUsers(req.auth?.user)).find((u) => u.id === consultantId && u.role === 'consultant');
    if (!consultant) throw notFound('Consultant');
    res.json(consultant.services);
  });

  function serviceFromBody(body, services, editingId) {
    const draft = {
      name: str(body?.name, 100),
      description: str(body?.description, 400),
      durationMins: body?.durationMins,
      price: Number.isInteger(body?.price) ? String(body.price) : '',
    };
    const error = firstError(validateService(draft, services, editingId));
    if (error) throw invalid(error);
    if (!DURATION_OPTIONS.includes(draft.durationMins)) throw invalid(`Choose a length: ${DURATION_OPTIONS.join(', ')} minutes.`);
    return { id: editingId ?? newId('s'), name: draft.name.trim(), description: draft.description.trim(), durationMins: draft.durationMins, price: body.price };
  }

  app.post('/api/services', signedIn, allow('consultant'), async (req, res) => {
    const me = await loadUser(req.auth.user.id);
    const service = serviceFromBody(req.body, me.services, null);
    const updated = { ...me, services: [...me.services, service] };
    await db.batch([saveProfile(updated)]);
    res.status(201).json({ service, user: updated });
  });

  app.patch('/api/services/:id', signedIn, allow('consultant'), async (req, res) => {
    const me = await loadUser(req.auth.user.id);
    const existing = me.services.find((s) => s.id === req.params.id);
    if (!existing) throw notFound('Service'); // also when it belongs to someone else
    const service = serviceFromBody({ ...existing, ...req.body }, me.services, existing.id);
    const updated = { ...me, services: me.services.map((s) => (s.id === existing.id ? service : s)) };
    await db.batch([saveProfile(updated)]);
    res.json({ service, user: updated });
  });

  app.delete('/api/services/:id', signedIn, allow('consultant'), async (req, res) => {
    const me = await loadUser(req.auth.user.id);
    if (!me.services.some((s) => s.id === req.params.id)) throw notFound('Service');
    const updated = { ...me, services: me.services.filter((s) => s.id !== req.params.id) };
    await db.batch([saveProfile(updated)]);
    res.json({ user: updated });
  });

  // ---- Categories ----------------------------------------------------------------------------

  const allCategories = () => db.all('SELECT id, name, description FROM categories ORDER BY rowid');

  app.get('/api/categories', async (_req, res) => {
    res.json(await allCategories());
  });

  function categoryFromBody(body, categories, editingId) {
    const draft = { name: str(body?.name, 100), description: str(body?.description, 200) };
    const error = firstError(validateCategory(draft, categories, editingId));
    if (error) throw invalid(error);
    return { id: editingId ?? newId('cat'), name: draft.name.trim(), description: draft.description.trim() };
  }

  app.post('/api/categories', signedIn, allow('admin'), async (req, res) => {
    const category = categoryFromBody(req.body, await allCategories(), null);
    await db.run('INSERT INTO categories (id, name, description) VALUES (?, ?, ?)', category.id, category.name, category.description);
    res.status(201).json(category);
  });

  app.patch('/api/categories/:id', signedIn, allow('admin'), async (req, res) => {
    const categories = await allCategories();
    const existing = categories.find((c) => c.id === req.params.id);
    if (!existing) throw notFound('Category');
    const category = categoryFromBody({ ...existing, ...req.body }, categories, existing.id);
    await db.run('UPDATE categories SET name = ?, description = ? WHERE id = ?', category.name, category.description, category.id);
    res.json(category);
  });

  app.delete('/api/categories/:id', signedIn, allow('admin'), async (req, res) => {
    if (!(await db.get('SELECT id FROM categories WHERE id = ?', req.params.id))) throw notFound('Category');
    const inUse = (await loadUsers("WHERE u.role = 'consultant'")).filter((u) => u.categoryId === req.params.id).length;
    if (inUse > 0) {
      throw new ApiError(409, 'category_in_use', `${inUse} consultant${inUse > 1 ? 's use' : ' uses'} this category. Move them to another category first.`);
    }
    await db.run('DELETE FROM categories WHERE id = ?', req.params.id);
    res.status(204).end();
  });

  // ---- Bookings ------------------------------------------------------------------------------

  /** Clients and consultants see their own bookings; admins see all. */
  async function ownBookings(user) {
    const rows =
      user.role === 'admin'
        ? await db.all('SELECT * FROM bookings ORDER BY date, time')
        : await db.all(`SELECT * FROM bookings WHERE ${user.role === 'client' ? 'client_id' : 'consultant_id'} = ? ORDER BY date, time`, user.id);
    return rows.map(toBooking);
  }

  async function ownBooking(user, id) {
    const row = await db.get('SELECT * FROM bookings WHERE id = ?', id);
    if (!row || (user.role !== 'admin' && row.client_id !== user.id && row.consultant_id !== user.id)) throw notFound('Booking');
    return toBooking(row);
  }

  /**
   * When a consultant is already booked (pending or confirmed, from today on), so the booking
   * screen only offers free slots. Times only: no client details.
   */
  app.get('/api/users/:id/busy', signedIn, async (req, res) => {
    const rows = await db.all(
      "SELECT id, consultant_id, date, time, duration_mins, status FROM bookings WHERE consultant_id = ? AND status IN ('pending', 'confirmed') AND date >= ? ORDER BY date, time",
      req.params.id,
      toISODate(nowDate()),
    );
    res.json(rows.map((r) => ({ id: r.id, consultantId: r.consultant_id, date: r.date, time: r.time, durationMins: r.duration_mins, status: r.status })));
  });

  app.get('/api/bookings', signedIn, async (req, res) => {
    res.json(await ownBookings(req.auth.user));
  });

  app.get('/api/bookings/:id', signedIn, async (req, res) => {
    res.json(await ownBooking(req.auth.user, req.params.id));
  });

  /** A client requests a session. It waits for the consultant to accept it. */
  app.post('/api/bookings', signedIn, allow('client'), async (req, res) => {
    const { consultantId, serviceId, date, time, mode } = req.body ?? {};
    const consultant = await loadUser(str(consultantId));
    if (!consultant || !bookable(consultant)) throw invalid('This consultant is not taking bookings right now.');
    const service = consultant.services.find((s) => s.id === serviceId);
    if (!service) throw invalid('That service is no longer offered. Please choose another.');
    if (!DATE_PATTERN.test(str(date)) || !TIME_PATTERN.test(str(time)) || !MODES.includes(mode)) throw invalid('Choose a date, time and how to meet.');
    // Re-checked here: the slot may have been taken since the app showed it.
    const taken = (await db.all('SELECT * FROM bookings WHERE consultant_id = ? AND date = ?', consultant.id, date)).map(toBooking);
    const slot = getSlots(consultant, date, service.durationMins, taken, nowDate()).find((s) => s.time === time);
    if (!slot?.available) throw new ApiError(409, 'slot_taken', 'That time is no longer available. Please pick another.');

    // Price and length are copied so later service edits don't change this booking.
    const booking = {
      id: newId('b'),
      clientId: req.auth.user.id,
      consultantId: consultant.id,
      serviceName: service.name,
      date,
      time,
      durationMins: service.durationMins,
      mode,
      note: str(req.body.note, 1000).trim(),
      status: 'pending',
      price: service.price,
    };
    await db.run(
      `INSERT INTO bookings (id, client_id, consultant_id, service_name, date, time, duration_mins, mode, note, status, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      booking.id, booking.clientId, booking.consultantId, booking.serviceName, booking.date, booking.time,
      booking.durationMins, booking.mode, booking.note, booking.status, booking.price,
    );
    res.status(201).json(booking);
  });

  /**
   * Moves a booking on. Client: cancel their own upcoming booking. Consultant: accept or decline a
   * request, or mark a started session completed. Admins only view bookings.
   */
  app.patch('/api/bookings/:id', signedIn, allow('client', 'consultant'), async (req, res) => {
    const user = req.auth.user;
    const booking = await ownBooking(user, req.params.id);
    const status = req.body?.status;
    const t = nowDate();
    let error;
    if (user.role === 'client') {
      if (status !== 'cancelled') throw forbidden('Clients can only cancel a booking.');
      if (!isUpcoming(booking, toISODate(t)) || hasStarted(booking, t) || !['pending', 'confirmed'].includes(booking.status)) {
        error = 'Only upcoming sessions can be cancelled.';
      }
    } else if (status === 'confirmed') {
      if (!canAccept(booking, t)) error = 'Only upcoming requests can be accepted.';
    } else if (status === 'declined') {
      if (!canDecline(booking)) error = 'Only requests can be declined.';
    } else if (status === 'completed') {
      if (!canComplete(booking, t)) error = 'A session can be marked completed once it has started.';
    } else {
      throw forbidden('Consultants can accept, decline or complete a booking.');
    }
    if (error) throw new ApiError(409, 'invalid_transition', error);
    // Only if nobody changed it meanwhile.
    const changed = await db.get('UPDATE bookings SET status = ? WHERE id = ? AND status = ? RETURNING *', status, booking.id, booking.status);
    if (!changed) throw new ApiError(409, 'conflict', 'This booking was just changed. Pull down to refresh.');
    res.json(toBooking(changed));
  });

  // ---- Reviews -------------------------------------------------------------------------------

  app.get('/api/reviews', optionalAuth, async (req, res) => {
    const viewer = req.auth?.user;
    const rows =
      viewer?.role === 'admin'
        ? await db.all('SELECT * FROM reviews ORDER BY created_at DESC')
        : // Your own removed reviews stay listed so the app knows that booking was already reviewed.
          await db.all('SELECT * FROM reviews WHERE removed_at IS NULL OR client_id = ? ORDER BY created_at DESC', viewer?.id ?? '');
    res.json(rows.map(toReview));
  });

  /** A client reviews one of their completed bookings, once. */
  app.post('/api/reviews', signedIn, allow('client'), async (req, res) => {
    const { bookingId, rating } = req.body ?? {};
    const booking = await ownBooking(req.auth.user, str(bookingId));
    if (booking.clientId !== req.auth.user.id || booking.status !== 'completed') throw invalid('You can review a session once, after it has been completed.');
    if (await db.get('SELECT id FROM reviews WHERE booking_id = ?', booking.id)) throw new ApiError(409, 'already_reviewed', 'You have already reviewed this session.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw invalid('Choose a rating from 1 to 5 stars.');
    const review = {
      id: newId('r'),
      bookingId: booking.id,
      clientId: booking.clientId,
      consultantId: booking.consultantId,
      rating,
      comment: str(req.body.comment, 2000).trim().slice(0, 500),
      createdAt: toISODate(nowDate()),
    };
    const consultant = await loadUser(booking.consultantId);
    await db.batch([
      sql(
        'INSERT INTO reviews (id, booking_id, client_id, consultant_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        review.id, review.bookingId, review.clientId, review.consultantId, review.rating, review.comment, review.createdAt,
      ),
      saveProfile({ ...consultant, ...adjustAverage(consultant.rating, consultant.reviewCount, rating, 1) }),
    ]);
    res.status(201).json(review);
  });

  /** Admin moderation: `{ removed: true }` hides a review and takes it out of the rating; false restores it. */
  app.patch('/api/reviews/:id', signedIn, allow('admin'), async (req, res) => {
    const row = await db.get('SELECT * FROM reviews WHERE id = ?', req.params.id);
    if (!row) throw notFound('Review');
    const remove = req.body?.removed;
    if (typeof remove !== 'boolean') throw invalid('Send { "removed": true } or { "removed": false }.');
    if (Boolean(row.removed_at) === remove) throw new ApiError(409, 'unchanged', remove ? 'This review is already removed.' : 'This review is already visible.');
    const consultant = await loadUser(row.consultant_id);
    const removedAt = remove ? toLocalDateTime(nowDate()) : null;
    await db.batch([
      sql('UPDATE reviews SET removed_at = ? WHERE id = ?', removedAt, row.id),
      saveProfile({ ...consultant, ...adjustAverage(consultant.rating, consultant.reviewCount, row.rating, remove ? -1 : 1) }),
    ]);
    res.json(toReview({ ...row, removed_at: removedAt }));
  });

  // ---- Conversations and messages (between a client and a consultant) -----------------------

  async function ownConversation(user, id) {
    const row = await db.get('SELECT * FROM conversations WHERE id = ?', id);
    if (!row || (row.client_id !== user.id && row.consultant_id !== user.id)) throw notFound('Conversation');
    return row;
  }

  app.get('/api/conversations', signedIn, async (req, res) => {
    const rows = await db.all('SELECT * FROM conversations WHERE client_id = ?1 OR consultant_id = ?1', req.auth.user.id);
    res.json(rows.map(toConversation));
  });

  /** All your messages, or one conversation's with ?conversationId=… */
  app.get('/api/messages', signedIn, async (req, res) => {
    const user = req.auth.user;
    const conversationId = str(req.query.conversationId);
    if (conversationId) await ownConversation(user, conversationId);
    const rows = await db.all(
      `SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.client_id = ?1 OR c.consultant_id = ?1) AND (?2 = '' OR c.id = ?2) ORDER BY m.sent_at, m.rowid`,
      user.id,
      conversationId,
    );
    res.json(rows.map(toMessage));
  });

  /** Sends a message to `recipientId`. The conversation is created with its first message. */
  app.post('/api/messages', signedIn, allow('client', 'consultant'), async (req, res) => {
    const user = req.auth.user;
    const other = await loadUser(str(req.body?.recipientId));
    const text = str(req.body?.text, 5000).trim();
    if (!other) throw notFound('Recipient');
    if (other.role === user.role || other.role === 'admin') throw forbidden('Clients and consultants can only message each other.');
    if (!text) throw invalid('Write a message first.');
    if (text.length > 1000) throw invalid('Messages can be up to 1000 characters.');
    const pair = user.role === 'client' ? { clientId: user.id, consultantId: other.id } : { clientId: other.id, consultantId: user.id };
    // A new conversation's id comes from the pair, so two quick first messages can't create two.
    const existing = await db.get('SELECT * FROM conversations WHERE client_id = ? AND consultant_id = ?', pair.clientId, pair.consultantId);
    const conversation = existing ? toConversation(existing) : { id: `c-${pair.clientId}-${pair.consultantId}`, ...pair };
    const message = { id: newId('m'), conversationId: conversation.id, senderId: user.id, text, sentAt: toLocalDateTime(nowDate()), read: false };
    await db.batch([
      sql('INSERT INTO conversations (id, client_id, consultant_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', conversation.id, pair.clientId, pair.consultantId),
      sql('INSERT INTO messages (id, conversation_id, sender_id, text, sent_at, read) VALUES (?, ?, ?, ?, ?, 0)', message.id, message.conversationId, message.senderId, message.text, message.sentAt),
    ]);
    res.status(201).json({ conversation, message });
  });

  /** Marks the other person's messages in a conversation as read. */
  app.patch('/api/conversations/:id', signedIn, async (req, res) => {
    const conversation = await ownConversation(req.auth.user, req.params.id);
    if (req.body?.read !== true) throw invalid('Send { "read": true } to mark the conversation read.');
    await db.run('UPDATE messages SET read = 1 WHERE conversation_id = ? AND sender_id != ?', conversation.id, req.auth.user.id);
    res.json(toConversation(conversation));
  });
}

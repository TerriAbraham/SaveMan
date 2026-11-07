import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClient } from '@libsql/client';

import { newProfile, profileOf } from './profiles.js';
import { hashPassword } from './security.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id                    TEXT PRIMARY KEY,
    email                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name                  TEXT NOT NULL,
    role                  TEXT NOT NULL CHECK (role IN ('client', 'consultant', 'admin')),
    password_hash         TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at            INTEGER NOT NULL,
    login_failures        INTEGER NOT NULL DEFAULT 0,
    login_locked_until    INTEGER NOT NULL DEFAULT 0,
    mfa_enabled           INTEGER NOT NULL DEFAULT 0,
    mfa_secret_enc        TEXT,             -- AES-256-GCM, never stored in plain text
    mfa_pending_enc       TEXT,             -- new secret waiting for its first code
    mfa_pending_at        INTEGER,
    mfa_last_step         INTEGER NOT NULL DEFAULT -1, -- last accepted TOTP step, blocks replays
    mfa_failures          INTEGER NOT NULL DEFAULT 0,
    mfa_locked_until      INTEGER NOT NULL DEFAULT 0,
    mfa_enabled_at        INTEGER,
    email_mfa             INTEGER NOT NULL DEFAULT 0 -- a client chose emailed login codes
  );

  CREATE TABLE IF NOT EXISTS recovery_codes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS recovery_codes_user ON recovery_codes(user_id);

  -- Full sessions plus the short-lived tokens between password and MFA. Only token hashes are kept.
  CREATE TABLE IF NOT EXISTS tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('session', 'mfa_challenge', 'mfa_setup')),
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id);

  -- 6-digit codes sent by email: for logging in, resetting a password, or turning on emailed codes.
  -- One live code per user and purpose, keyed hash only.
  CREATE TABLE IF NOT EXISTS email_codes (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL CHECK (purpose IN ('login', 'reset', 'enable')),
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    sent_at    INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, purpose)
  );

  -- One-time codes an administrator gives someone who forgot their password. Keyed hash only.
  CREATE TABLE IF NOT EXISTS password_resets (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0
  );

  -- App data, served by the REST routes in resources.js. Shapes match src/data/types.ts.

  -- Everything about a user that isn't an account field: phone, city, and a consultant's title,
  -- services, availability, verification, rating... JSON, because it's read and written as a whole.
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id            TEXT PRIMARY KEY,
    client_id     TEXT NOT NULL REFERENCES users(id),
    consultant_id TEXT NOT NULL REFERENCES users(id),
    service_name  TEXT NOT NULL,
    date          TEXT NOT NULL, -- YYYY-MM-DD
    time          TEXT NOT NULL, -- HH:mm, local time
    duration_mins INTEGER NOT NULL,
    mode          TEXT NOT NULL CHECK (mode IN ('in-person', 'video', 'phone')),
    note          TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'declined')),
    price         INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS bookings_client ON bookings(client_id);
  CREATE INDEX IF NOT EXISTS bookings_consultant ON bookings(consultant_id, date);

  CREATE TABLE IF NOT EXISTS reviews (
    id            TEXT PRIMARY KEY,
    booking_id    TEXT NOT NULL UNIQUE REFERENCES bookings(id), -- one review per booking
    client_id     TEXT NOT NULL REFERENCES users(id),
    consultant_id TEXT NOT NULL REFERENCES users(id),
    rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL,
    removed_at    TEXT -- set by an admin; kept so it can be restored
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    client_id     TEXT NOT NULL REFERENCES users(id),
    consultant_id TEXT NOT NULL REFERENCES users(id),
    UNIQUE (client_id, consultant_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    sender_id       TEXT NOT NULL REFERENCES users(id),
    text            TEXT NOT NULL,
    sent_at         TEXT NOT NULL, -- local YYYY-MM-DDTHH:mm:ss
    read            INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id);

  -- Profile photos, already shrunk by the app. The random id is the photo's address, so a new
  -- photo gets a new address and old copies cached on phones are never shown by mistake.
  CREATE TABLE IF NOT EXISTS photos (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    created_at INTEGER NOT NULL
  );
`;

/** A statement plus its arguments, for `db.batch`. */
export const sql = (text, ...args) => ({ sql: text, args });

/**
 * Opens the database: Turso when `url` is a libsql:// address (needs `authToken`), otherwise a local
 * SQLite file at `path` (or ':memory:' for tests). Returns small async helpers over it.
 */
export async function openDb({ path, url, authToken }) {
  let client;
  if (url) {
    client = createClient({ url, authToken });
  } else if (path === ':memory:') {
    client = createClient({ url: ':memory:' });
  } else {
    mkdirSync(dirname(path), { recursive: true });
    client = createClient({ url: pathToFileURL(path).href });
    await client.executeMultiple('PRAGMA journal_mode = WAL;');
  }
  // Local only: Turso runs statements over HTTP, so a per-connection pragma wouldn't stick.
  if (!url) await client.execute('PRAGMA foreign_keys = ON');
  // One statement per batch entry (comments removed), so the tables are created all-or-nothing
  // the same way on a local file and on Turso.
  const schema = SCHEMA.replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  await client.batch(schema, 'write');
  // Columns added after the first release, for databases made before them.
  const columns = (await client.execute("SELECT name FROM pragma_table_info('users')")).rows.map((r) => r.name);
  if (!columns.includes('email_mfa')) await client.execute('ALTER TABLE users ADD COLUMN email_mfa INTEGER NOT NULL DEFAULT 0');

  const run = (text, args) => client.execute({ sql: text, args });
  return {
    client,
    /** First row, or undefined. */
    get: async (text, ...args) => (await run(text, args)).rows[0],
    all: async (text, ...args) => (await run(text, args)).rows,
    run: (text, ...args) => run(text, args),
    /** Runs the statements (built with `sql`) all-or-nothing. */
    batch: (statements) => client.batch(statements, 'write'),
    close: () => client.close(),
  };
}

/** First run only: load the app's demo accounts (src/data/users.ts) so the same logins work. */
export async function seedIfEmpty(db) {
  const { count } = await db.get('SELECT COUNT(*) AS count FROM users');
  let seeded = 0;
  if (count === 0) {
    const { seedUsers } = await import('../../src/data/users.ts');
    await db.batch(
      seedUsers.map((u) =>
        sql(
          'INSERT INTO users (id, email, name, role, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          u.id,
          u.email.toLowerCase(),
          u.name,
          u.role,
          hashPassword(u.password),
          u.status,
          Date.parse(u.createdAt),
        ),
      ),
    );
    seeded = seedUsers.length;
  }
  await seedAppData(db);
  return seeded;
}

/**
 * The mock data the app started with: profiles, categories, bookings, reviews and messages
 * (src/data/). Each part is added only if it's missing, so a database from before these
 * tables existed is filled in without touching its accounts.
 */
async function seedAppData(db) {
  const { seedUsers } = await import('../../src/data/users.ts');
  const seedById = new Map(seedUsers.map((u) => [u.id, u]));

  // Profiles for accounts that don't have one: demo accounts get theirs, others an empty one.
  const missing = await db.all('SELECT u.id, u.role, u.created_at FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE p.user_id IS NULL');
  const statements = missing.map((u) => {
    const seed = seedById.get(u.id);
    return sql('INSERT INTO profiles (user_id, data) VALUES (?, ?)', u.id, JSON.stringify(seed ? profileOf(seed) : newProfile(u.role, {}, u.created_at)));
  });

  if ((await db.get('SELECT COUNT(*) AS n FROM categories')).n === 0) {
    const { categories } = await import('../../src/data/categories.ts');
    const activity = await import('../../src/data/activity.ts');
    statements.push(
      ...categories.map((c) => sql('INSERT INTO categories (id, name, description) VALUES (?, ?, ?)', c.id, c.name, c.description)),
      ...activity.bookings.map((b) =>
        sql(
          `INSERT INTO bookings (id, client_id, consultant_id, service_name, date, time, duration_mins, mode, note, status, price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          b.id, b.clientId, b.consultantId, b.serviceName, b.date, b.time, b.durationMins, b.mode, b.note, b.status, b.price,
        ),
      ),
      ...activity.reviews.map((r) =>
        sql(
          'INSERT INTO reviews (id, booking_id, client_id, consultant_id, rating, comment, created_at, removed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          r.id, r.bookingId, r.clientId, r.consultantId, r.rating, r.comment, r.createdAt, r.removedAt ?? null,
        ),
      ),
      ...activity.conversations.map((c) => sql('INSERT INTO conversations (id, client_id, consultant_id) VALUES (?, ?, ?)', c.id, c.clientId, c.consultantId)),
      ...activity.messages.map((m) =>
        sql('INSERT INTO messages (id, conversation_id, sender_id, text, sent_at, read) VALUES (?, ?, ?, ?, ?, ?)', m.id, m.conversationId, m.senderId, m.text, m.sentAt, m.read ? 1 : 0),
      ),
    );
  }
  if (statements.length) await db.batch(statements);
}

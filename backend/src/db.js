import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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
    mfa_enabled_at        INTEGER
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
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

/** First run only: load the app's demo accounts (src/data/users.ts) so the same logins work. */
export async function seedIfEmpty(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return 0;
  const { seedUsers } = await import('../../src/data/users.ts');
  const insert = db.prepare(
    'INSERT INTO users (id, email, name, role, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  db.exec('BEGIN');
  for (const u of seedUsers) {
    insert.run(u.id, u.email.toLowerCase(), u.name, u.role, hashPassword(u.password), u.status, Date.parse(u.createdAt));
  }
  db.exec('COMMIT');
  return seedUsers.length;
}

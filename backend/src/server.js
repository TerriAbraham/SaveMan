import { networkInterfaces } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

import { createApp } from './app.js';
import { DB_PATH, HOST, PORT, TRUST_PROXY, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, deriveKeys } from './config.js';
import { openDb, seedIfEmpty } from './db.js';

const TURSO_ATTEMPTS = 3;

/** An error's code and message, for the log. Database errors never include the token. */
const describe = (err) => [err?.code, err?.message ?? String(err)].filter(Boolean).join(': ');

/** Why Turso couldn't be used, as a short code that's safe to show publicly on /api/health. */
function tursoProblem(err) {
  const text = describe(err);
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden|jwt|token/i.test(text)) return 'token_rejected';
  if (/\b404\b|not found/i.test(text)) return 'database_not_found';
  if (/ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|fetch failed|network/i.test(text)) return 'unreachable';
  return 'error';
}

/** A message with addresses removed, short enough for /api/health. */
const scrub = (text) => text.replace(/[a-z]+:\/\/\S+/gi, '<url>').replace(/[\w.-]+\.turso\.io/gi, '<host>').slice(0, 300);

/** TEMPORARY: Turso's raw reply (status and body) to `SELECT 1`, scrubbed. */
async function probeTurso() {
  try {
    const res = await fetch(new URL('/v2/pipeline', TURSO_DATABASE_URL), {
      method: 'POST',
      headers: { Authorization: `Bearer ${TURSO_AUTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT 1' } }, { type: 'close' }] }),
      signal: AbortSignal.timeout(10_000),
    });
    return scrub(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    return scrub(describe(err));
  }
}

/**
 * Turso when it's set up and reachable. Otherwise a local database file, so the API still starts
 * (on Render's free plan that file is wiped on restart) and the log says what to fix.
 */
async function openDatabase() {
  let turso = 'not_configured';
  let tursoDetail; // TEMPORARY: the last Turso error, without addresses, while diagnosing the Render deploy
  if (TURSO_DATABASE_URL) {
    const host = new URL(TURSO_DATABASE_URL).host;
    if (!TURSO_AUTH_TOKEN) {
      turso = 'missing_token';
      console.error('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is empty. Add the token from the Turso dashboard.');
    } else {
      for (let attempt = 1; attempt <= TURSO_ATTEMPTS; attempt++) {
        let stage = 'schema';
        try {
          const db = await openDb({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
          stage = 'seed';
          const seeded = await seedIfEmpty(db);
          console.log(`Using Turso database ${host}${seeded ? ` (seeded ${seeded} demo accounts)` : ''}`);
          return { db, database: 'turso' };
        } catch (err) {
          turso = tursoProblem(err);
          tursoDetail = scrub(`${stage}: ${describe(err)}`);
          console.error(`Couldn't use Turso database ${host} (attempt ${attempt} of ${TURSO_ATTEMPTS}, ${stage}): ${describe(err)}`);
          if (attempt < TURSO_ATTEMPTS) await sleep(attempt * 2000);
        }
      }
      // TEMPORARY: what Turso says to the simplest possible request, to tell a bad setting from a bad query.
      tursoDetail += ` | probe: ${await probeTurso()}`;
      console.error(`Turso probe: ${tursoDetail}`);
    }
    console.error(
      'Falling back to a local database: changes are lost when the server restarts. ' +
        'Check TURSO_DATABASE_URL (libsql://…) and TURSO_AUTH_TOKEN (read & write) in your hosting settings.',
    );
  }
  const db = await openDb({ path: DB_PATH });
  const seeded = await seedIfEmpty(db);
  console.log(`Using local database ${DB_PATH}${seeded ? ` (seeded ${seeded} demo accounts)` : ''}`);
  if (process.env.NODE_ENV === 'production' && turso === 'not_configured') {
    console.error('TURSO_DATABASE_URL is not set, so data is kept in a local file. Set it (and TURSO_AUTH_TOKEN) to keep data permanently.');
  }
  return { db, database: 'local', turso, tursoDetail };
}

const { db, database, turso, tursoDetail } = await openDatabase();
const app = createApp({ db, keys: deriveKeys(), trustProxy: TRUST_PROXY, database, turso, tursoDetail });

const server = app.listen(PORT, HOST, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
  console.log(`SaveMan API listening on http://localhost:${PORT}`);
  for (const url of lan) console.log(`  on your network: ${url}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Is the SaveMan API already running?`);
  else console.error(err);
  process.exit(1);
});

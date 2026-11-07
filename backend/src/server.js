import { networkInterfaces } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

import { createApp } from './app.js';
import { DB_PATH, HOST, PORT, TRUST_PROXY, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, deriveKeys } from './config.js';
import { openDb, seedIfEmpty } from './db.js';

const TURSO_ATTEMPTS = 3;

/** An error's code and message, for the log. Database errors never include the token. */
const describe = (err) => [err?.code, err?.message ?? String(err)].filter(Boolean).join(': ');

/**
 * Turso when it's set up and reachable. Otherwise a local database file, so the API still starts
 * (on Render's free plan that file is wiped on restart) and the log says what to fix.
 */
async function openDatabase() {
  if (TURSO_DATABASE_URL) {
    const host = new URL(TURSO_DATABASE_URL).host;
    if (!TURSO_AUTH_TOKEN) {
      console.error('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is empty. Add the token from the Turso dashboard.');
    } else {
      for (let attempt = 1; attempt <= TURSO_ATTEMPTS; attempt++) {
        try {
          const db = await openDb({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
          const seeded = await seedIfEmpty(db);
          console.log(`Using Turso database ${host}${seeded ? ` (seeded ${seeded} demo accounts)` : ''}`);
          return { db, database: 'turso' };
        } catch (err) {
          console.error(`Couldn't use Turso database ${host} (attempt ${attempt} of ${TURSO_ATTEMPTS}): ${describe(err)}`);
          if (attempt < TURSO_ATTEMPTS) await sleep(attempt * 2000);
        }
      }
    }
    console.error(
      'Falling back to a local database: changes are lost when the server restarts. ' +
        'Check TURSO_DATABASE_URL (libsql://…) and TURSO_AUTH_TOKEN (read & write) in your hosting settings.',
    );
  }
  const db = await openDb({ path: DB_PATH });
  const seeded = await seedIfEmpty(db);
  console.log(`Using local database ${DB_PATH}${seeded ? ` (seeded ${seeded} demo accounts)` : ''}`);
  return { db, database: 'local' };
}

const { db, database } = await openDatabase();
const app = createApp({ db, keys: deriveKeys(), trustProxy: TRUST_PROXY, database });

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

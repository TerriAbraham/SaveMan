import { networkInterfaces } from 'node:os';

import { createApp } from './app.js';
import { DB_PATH, HOST, PORT, TRUST_PROXY, TURSO_AUTH_TOKEN, TURSO_DATABASE_URL, deriveKeys } from './config.js';
import { openDb, seedIfEmpty } from './db.js';

const db = await openDb({ path: DB_PATH, url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
console.log(TURSO_DATABASE_URL ? `Using Turso database ${new URL(TURSO_DATABASE_URL).host}` : `Using local database ${DB_PATH}`);
const seeded = await seedIfEmpty(db);
if (seeded) console.log(`Seeded ${seeded} demo accounts from src/data/users.ts`);

const app = createApp({ db, keys: deriveKeys(), trustProxy: TRUST_PROXY });

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

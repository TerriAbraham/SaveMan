import { networkInterfaces } from 'node:os';

import { createApp } from './app.js';
import { DB_PATH, PORT, deriveKeys } from './config.js';
import { openDb, seedIfEmpty } from './db.js';

const db = openDb(DB_PATH);
const seeded = await seedIfEmpty(db);
if (seeded) console.log(`Seeded ${seeded} demo accounts from src/data/users.ts`);

const app = createApp({ db, keys: deriveKeys() });

// 0.0.0.0 so a phone running Expo Go on the same Wi-Fi can reach it.
app.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
  console.log(`SaveMan API listening on http://localhost:${PORT}`);
  for (const url of lan) console.log(`  on your network: ${url}`);
});

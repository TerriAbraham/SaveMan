// Deletes the local database so the next start re-seeds the demo accounts (MFA off for everyone).
// A Turso database isn't touched: delete and recreate it from the Turso dashboard instead.
import { rmSync } from 'node:fs';

import { DB_PATH } from './config.js';

for (const suffix of ['', '-wal', '-shm']) rmSync(DB_PATH + suffix, { force: true });
console.log(`Removed ${DB_PATH}. Start the server again to re-seed the demo accounts.`);

/**
 * Keeps the SaveMan API running: starts src/server.js and restarts it whenever it stops.
 * Output goes to data/server.log. Run with `npm run forever`; `npm run autostart` makes
 * Windows run this at log-in.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DATA_DIR, PORT } from './config.js';

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_PATH = join(DATA_DIR, 'server.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;

mkdirSync(DATA_DIR, { recursive: true });
// Keep one old log so the file can't grow forever.
try {
  if (statSync(LOG_PATH).size > MAX_LOG_BYTES) renameSync(LOG_PATH, `${LOG_PATH}.old`);
} catch {}
const log = createWriteStream(LOG_PATH, { flags: 'a' });
const write = (line) => {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  log.write(text);
  process.stdout.write(text);
};

/** True if something on the port already answers like the SaveMan API. */
async function alreadyRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

let delay = 1000;

async function start() {
  // Another copy (e.g. `npm start` in a terminal) is serving: check back later instead of fighting for the port.
  if (await alreadyRunning()) {
    setTimeout(start, 30_000);
    return;
  }
  const startedAt = Date.now();
  const child = spawn(
    process.execPath,
    [
      '--import=./src/ts-paths.js',
      '--env-file-if-exists=.env',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--disable-warning=ExperimentalWarning',
      'src/server.js',
    ],
    { cwd: BACKEND_DIR, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  write(`Started server (pid ${child.pid})`);
  child.stdout.on('data', (d) => {
    log.write(d);
    process.stdout.write(d);
  });
  child.stderr.on('data', (d) => {
    log.write(d);
    process.stderr.write(d);
  });
  child.on('exit', (code, signal) => {
    // A run that lasted a minute was healthy, so restart quickly; repeated quick crashes back off up to 30 s.
    delay = Date.now() - startedAt > 60_000 ? 1000 : Math.min(delay * 2, 30_000);
    write(`Server stopped (${signal ?? `code ${code}`}). Restarting in ${delay / 1000}s.`);
    setTimeout(start, delay);
  });
}

write(`Supervisor running (pid ${process.pid})`);
start();

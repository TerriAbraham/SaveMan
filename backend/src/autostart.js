/**
 * Windows only: `node src/autostart.js` adds a hidden launcher to your Startup folder so the
 * supervisor (src/supervise.js) runs every time you log in, then starts it now.
 * `node src/autostart.js remove` takes it out again. No administrator rights needed.
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.error('Autostart is only set up for Windows. Run `npm run forever` instead.');
  process.exit(1);
}

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const STARTUP_DIR = join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const LAUNCHER = join(STARTUP_DIR, 'SaveMan API.vbs');

if (process.argv[2] === 'remove') {
  if (existsSync(LAUNCHER)) rmSync(LAUNCHER);
  console.log('Removed the SaveMan API from Startup. A copy that is already running keeps going until you log out.');
  process.exit(0);
}

// VBScript runs the command with no console window (the 0). Quotes are doubled inside VBS strings.
const command = `"${process.execPath}" "${join(BACKEND_DIR, 'src', 'supervise.js')}"`;
writeFileSync(
  LAUNCHER,
  `Set shell = CreateObject("WScript.Shell")\r\nshell.CurrentDirectory = "${BACKEND_DIR}"\r\nshell.Run "${command.replaceAll('"', '""')}", 0, False\r\n`,
);
console.log(`Added ${LAUNCHER}`);

spawn('wscript.exe', [LAUNCHER], { detached: true, stdio: 'ignore' }).unref();
console.log('Started the SaveMan API in the background. It will also start whenever you log in.');
console.log(`Log: ${join(BACKEND_DIR, 'data', 'server.log')}`);

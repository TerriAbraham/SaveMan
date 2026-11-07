import type { SavedSession } from './types';

export type { SavedSession } from './types';

// Web version of local-store.ts: the browser's localStorage, which needs no extra setup
// (expo-sqlite on web needs WebAssembly and special server headers). It can be unavailable,
// e.g. in private browsing, so every access is guarded.

const DATA_VERSION = 2;
const key = (name: string) => `saveman.v${DATA_VERSION}.${name}`;
const SESSION_KEY = 'saveman_session';

function read(k: string) {
  try {
    return globalThis.localStorage?.getItem(k) ?? null;
  } catch {
    return null;
  }
}

function write(k: string, value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(k);
    else globalThis.localStorage?.setItem(k, value);
  } catch {}
}

export function loadSaved<T>(name: string, fallback: T): T {
  const raw = read(key(name));
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(name: string, value: unknown) {
  write(key(name), JSON.stringify(value));
}

export function loadSession(): SavedSession | null {
  const raw = read(SESSION_KEY);
  try {
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SavedSession | null) {
  write(SESSION_KEY, session ? JSON.stringify(session) : null);
}

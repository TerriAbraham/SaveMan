import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';

import type { SavedSession } from './types';

export type { SavedSession } from './types';

/**
 * Data saved on the phone, so the app keeps its data between launches and works offline.
 * App data goes in SQLite (expo-sqlite's key-value table); the login token goes in the
 * phone's secure storage (Keychain / Keystore). Web uses local-store.web.ts instead.
 *
 * Bump DATA_VERSION when the shape of saved data changes: older saves are then ignored.
 */
const DATA_VERSION = 2;
const key = (name: string) => `saveman.v${DATA_VERSION}.${name}`;
const SESSION_KEY = 'saveman_session'; // SecureStore keys allow only letters, digits, '.', '-' and '_'

/** The saved value, or `fallback` when nothing is saved yet (or it can't be read). */
export function loadSaved<T>(name: string, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key(name));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Saves in the background; a failed save only means the change isn't kept after a restart. */
export function save(name: string, value: unknown) {
  Storage.setItem(key(name), JSON.stringify(value)).catch((err) => console.warn(`Couldn't save ${name}`, err));
}

export function loadSession(): SavedSession | null {
  try {
    const raw = SecureStore.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SavedSession | null) {
  const done = session ? SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)) : SecureStore.deleteItemAsync(SESSION_KEY);
  done.catch((err) => console.warn("Couldn't save the login session", err));
}

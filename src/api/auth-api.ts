import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { Role, User } from '@/data/types';

/**
 * Where the SaveMan API (backend/) runs. Set EXPO_PUBLIC_API_URL in .env to override.
 * Otherwise it's port 4000 on the same computer as the Expo dev server, which is what
 * Expo Go on a phone needs (the PC's Wi-Fi address, not localhost).
 */
function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:4000`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:4000`;
  return 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

/** What comes back after a password: a session, or a short-lived token for the MFA step. */
export type LoginResponse =
  | { status: 'ok'; token: string; user: ApiUser }
  | { status: 'mfa_required' | 'mfa_setup_required'; mfaToken: string; user: ApiUser };

export interface MfaVerifyResponse {
  status: 'ok';
  token: string;
  user: ApiUser;
  usedRecoveryCode: boolean;
  recoveryCodesRemaining: number;
}

export interface MfaSetupData {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  expiresInSeconds: number;
}

export interface MfaEnableResponse {
  status: 'ok';
  recoveryCodes: string[];
  token?: string; // only when enrolling during login
  user: ApiUser;
}

export interface MfaStatus {
  enabled: boolean;
  required: boolean;
  enabledAt: number | null;
  recoveryCodesRemaining: number;
}

/** A 6-digit code from the authenticator app, or one of the recovery codes. */
export type SecondFactor = { code: string } | { recoveryCode: string };

/** The hosted API (Render's free plan) sleeps when idle and can take about a minute to wake. */
const REQUEST_TIMEOUT_MS = 75_000;
/** A request slower than this is probably waiting for the server to wake up. */
const SLOW_REQUEST_MS = 4_000;

// How many requests are currently slow, so screens can say the server is waking up.
let slowRequests = 0;
const wakingListeners = new Set<() => void>();
const setSlow = (delta: number) => {
  slowRequests += delta;
  wakingListeners.forEach((l) => l());
};
export const serverWaking = {
  subscribe(listener: () => void) {
    wakingListeners.add(listener);
    return () => wakingListeners.delete(listener);
  },
  get: () => slowRequests > 0,
};

const isLocalApi = /^http:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(API_URL);

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Calls the SaveMan API. Throws ApiError with the server's message, or code 'network' when it can't be reached. */
export async function request<T>(method: HttpMethod, path: string, body?: object, token?: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let slow = false;
  const slowTimer = setTimeout(() => {
    slow = true;
    setSlow(1);
  }, SLOW_REQUEST_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      isLocalApi
        ? `Can't reach the SaveMan server at ${API_URL}. Check it's running and your phone is on the same Wi-Fi.`
        : "Can't reach the SaveMan server. Check your internet connection and try again.",
      'network',
      0,
    );
  } finally {
    clearTimeout(timeout);
    clearTimeout(slowTimer);
    if (slow) setSlow(-1);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error?.message ?? 'Something went wrong. Please try again.', data?.error?.code ?? 'unknown', res.status);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>('POST', '/api/auth/login', { email, password }),
  /** Creates the account and its profile. `title` and `categoryId` are for consultants. */
  register: (input: {
    role: 'client' | 'consultant';
    name: string;
    email: string;
    password: string;
    phone: string;
    city: string;
    title?: string;
    categoryId?: string;
  }) =>
    request<LoginResponse>('POST', '/api/auth/register', input),
  verifyMfa: (mfaToken: string, factor: SecondFactor) => request<MfaVerifyResponse>('POST', '/api/auth/mfa/verify', factor, mfaToken),
  logout: (token: string) => request<{ ok: true }>('POST', '/api/auth/logout', undefined, token),
  /** The signed-in user's full profile. */
  me: (token: string) => request<User & { mfaEnabled: boolean }>('GET', '/api/auth/me', undefined, token),

  mfaStatus: (token: string) => request<MfaStatus>('GET', '/api/mfa/status', undefined, token),
  /** `reauth` is needed only when moving an existing authenticator to a new phone. */
  mfaSetup: (token: string, reauth?: { password: string } & SecondFactor) => request<MfaSetupData>('POST', '/api/mfa/setup', reauth ?? {}, token),
  mfaEnable: (token: string, code: string) => request<MfaEnableResponse>('POST', '/api/mfa/enable', { code }, token),
  regenerateRecoveryCodes: (token: string, code: string) =>
    request<{ recoveryCodes: string[] }>('POST', '/api/mfa/recovery-codes', { code }, token),
  disableMfa: (token: string, password: string, factor: SecondFactor) =>
    request<{ status: 'ok'; user: ApiUser }>('POST', '/api/mfa/disable', { password, ...factor }, token),
};

export function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

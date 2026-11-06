import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { Role } from '@/data/types';

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

async function request<T>(method: 'GET' | 'POST', path: string, body?: object, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
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
      `Can't reach the SaveMan server at ${API_URL}. Check it's running and your phone is on the same Wi-Fi.`,
      'network',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error?.message ?? 'Something went wrong. Please try again.', data?.error?.code ?? 'unknown', res.status);
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) => request<LoginResponse>('POST', '/api/auth/login', { email, password }),
  register: (input: { role: 'client' | 'consultant'; name: string; email: string; password: string }) =>
    request<LoginResponse>('POST', '/api/auth/register', input),
  verifyMfa: (mfaToken: string, factor: SecondFactor) => request<MfaVerifyResponse>('POST', '/api/auth/mfa/verify', factor, mfaToken),
  logout: (token: string) => request<{ ok: true }>('POST', '/api/auth/logout', undefined, token),

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

import { createContext, useContext, useState, type ReactNode } from 'react';

import {
  ApiError,
  authApi,
  errorMessage,
  type ApiUser,
  type LoginResponse,
  type MfaEnableResponse,
  type MfaSetupData,
  type MfaStatus,
  type MfaVerifyResponse,
  type SecondFactor,
} from '@/api/auth-api';
import { places, seedUsers, standardWeek } from '@/data/users';
import type { AccountStatus, Client, Consultant, User, VerificationStatus } from '@/data/types';
import { adjustAverage } from '@/utils/ratings';
export interface SignUpInput {
  role: 'client' | 'consultant';
  name: string;
  email: string;
  phone: string;
  password: string;
  city: string;
  // Consultant only
  title?: string;
  categoryId?: string;
}

/** Fields a consultant can change themselves: profile, services and availability. */
export type ConsultantProfileChanges = Partial<
  Pick<Consultant, 'title' | 'categoryId' | 'bio' | 'hourlyRate' | 'location' | 'qualifications' | 'services' | 'availability'>
>;

/** Contact details any user can change. `city` applies to clients only. */
export interface OwnProfileChanges {
  name: string;
  phone: string;
  city?: string;
}

/** Where to go after a password: signed in, or one of the MFA screens. */
export type AuthResult = { error: string } | { next: 'done' | 'mfa-verify' | 'mfa-setup' };

/** Password accepted, MFA still to do: enter a code ('verify') or enrol first ('setup'). */
export interface PendingMfa {
  kind: 'verify' | 'setup';
  mfaToken: string;
  user: ApiUser;
}

interface Session {
  token: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

interface AuthContextValue {
  user: User | null;
  users: User[];
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => void;

  // Multi-factor authentication. These throw ApiError; show it with errorMessage().
  pendingMfa: PendingMfa | null;
  /** MFA state of the signed-in account. */
  security: { mfaEnabled: boolean; mfaRequired: boolean } | null;
  verifyMfa: (factor: SecondFactor) => Promise<MfaVerifyResponse>;
  /** Opens the session from verifyMfa / confirmMfaSetup. Separate so screens can show a notice first. */
  completeSignIn: (result: { token?: string; user: ApiUser }) => void;
  cancelMfa: () => void;
  /** New secret to scan. `reauth` only when replacing an authenticator that's already on. */
  startMfaSetup: (reauth?: { password: string } & SecondFactor) => Promise<MfaSetupData>;
  confirmMfaSetup: (code: string) => Promise<MfaEnableResponse>;
  getMfaStatus: () => Promise<MfaStatus>;
  regenerateRecoveryCodes: (code: string) => Promise<string[]>;
  disableMfa: (password: string, factor: SecondFactor) => Promise<void>;

  /** Signed-in consultant only. Returns an error message, or null on success. */
  updateConsultant: (changes: ConsultantProfileChanges) => string | null;
  /** Signed-in user's name, phone (and city for clients). Returns an error message, or null. */
  updateOwnProfile: (changes: OwnProfileChanges) => string | null;
  adjustRating: (consultantId: string, rating: number, change: 1 | -1) => void;
  /** Admin only. Returns an error message, or null on success. */
  setVerification: (consultantId: string, verification: VerificationStatus) => string | null;
  /** Admin only. Returns an error message, or null on success. */
  setAccountStatus: (userId: string, status: AccountStatus) => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SUSPENDED = 'This account has been suspended. Contact SaveMan support.';
const noSession = () => new ApiError('Please log in again.', 'unauthorized', 401);

/** A new account's in-memory profile. Consultants start unverified with an empty profile. */
function buildProfile(id: string, input: Omit<SignUpInput, 'password'>): User {
  const base = {
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: '', // the password lives only on the server, hashed
    phone: input.phone.trim(),
    status: 'active' as const,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  if (input.role === 'client') return { ...base, role: 'client', city: input.city } satisfies Client;

  // Start at the chosen town centre; the consultant can set their exact office pin later.
  const place = Object.values(places).find((p) => p.city === input.city) ?? places.portMoresby;
  return {
    ...base,
    role: 'consultant',
    title: input.title?.trim() ?? '',
    categoryId: input.categoryId ?? '',
    bio: '',
    expertise: [],
    qualifications: [],
    services: [],
    availability: standardWeek,
    hourlyRate: 0,
    yearsExperience: 0,
    languages: ['English'],
    location: { ...place, address: '' },
    verification: 'pending', // new consultants wait for admin approval
    rating: 0,
    reviewCount: 0,
  } satisfies Consultant;
}

// Passwords, sessions and MFA are checked by the SaveMan API (backend/). Profiles, bookings and
// the rest are still in-memory only: accounts created at sign-up reset here when the app reloads.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);

  const user = users.find((u) => u.id === userId) ?? null;

  /** Session token, or the enrolment token while a required-MFA user sets up their authenticator. */
  function setupToken() {
    const token = pendingMfa?.kind === 'setup' ? pendingMfa.mfaToken : session?.token;
    if (!token) throw noSession();
    return token;
  }

  function sessionToken() {
    if (!session) throw noSession();
    return session.token;
  }

  function afterPassword(res: LoginResponse, profile?: User): AuthResult {
    const token = res.status === 'ok' ? res.token : res.mfaToken;
    // Suspension is managed by the admin screens in the app, so it's checked here too.
    if (users.find((u) => u.id === res.user.id)?.status === 'suspended') {
      authApi.logout(token).catch(() => {});
      return { error: SUSPENDED };
    }
    // An account made in an earlier run of the app is still on the server; give it a fresh profile here.
    const local =
      profile ?? buildProfile(res.user.id, { role: res.user.role === 'consultant' ? 'consultant' : 'client', name: res.user.name, email: res.user.email, phone: '', city: '' });
    setUsers((prev) => (prev.some((u) => u.id === res.user.id) ? prev : [...prev, local]));

    if (res.status === 'ok') {
      completeSignIn(res);
      return { next: 'done' };
    }
    const kind = res.status === 'mfa_required' ? 'verify' : 'setup';
    setPendingMfa({ kind, mfaToken: res.mfaToken, user: res.user });
    return { next: kind === 'verify' ? 'mfa-verify' : 'mfa-setup' };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    try {
      return afterPassword(await authApi.login(email.trim(), password));
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }

  async function signUp(input: SignUpInput): Promise<AuthResult> {
    try {
      const res = await authApi.register({ role: input.role, name: input.name.trim(), email: input.email.trim(), password: input.password });
      return afterPassword(res, buildProfile(res.user.id, input));
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }

  function completeSignIn({ token, user: apiUser }: { token?: string; user: ApiUser }) {
    if (!token) return;
    setSession({ token, mfaEnabled: apiUser.mfaEnabled, mfaRequired: apiUser.mfaRequired });
    setPendingMfa(null);
    setUserId(apiUser.id); // the root layout switches to the user's section
  }

  function cancelMfa() {
    if (pendingMfa) authApi.logout(pendingMfa.mfaToken).catch(() => {});
    setPendingMfa(null);
  }

  function verifyMfa(factor: SecondFactor) {
    if (pendingMfa?.kind !== 'verify') throw noSession();
    return authApi.verifyMfa(pendingMfa.mfaToken, factor);
  }

  function startMfaSetup(reauth?: { password: string } & SecondFactor) {
    return authApi.mfaSetup(setupToken(), reauth);
  }

  async function confirmMfaSetup(code: string) {
    const res = await authApi.mfaEnable(setupToken(), code);
    // Enrolling during login: the session opens once the recovery codes have been saved (completeSignIn).
    if (session) setSession({ ...session, mfaEnabled: true });
    return res;
  }

  function getMfaStatus() {
    return authApi.mfaStatus(sessionToken());
  }

  async function regenerateRecoveryCodes(code: string) {
    return (await authApi.regenerateRecoveryCodes(sessionToken(), code)).recoveryCodes;
  }

  async function disableMfa(password: string, factor: SecondFactor) {
    const res = await authApi.disableMfa(sessionToken(), password, factor);
    setSession((s) => (s ? { ...s, mfaEnabled: res.user.mfaEnabled } : s));
  }

  function signOut() {
    if (session) authApi.logout(session.token).catch(() => {});
    setSession(null);
    setPendingMfa(null);
    setUserId(null);
  }

  // Profile changes always apply to the signed-in user, so one account can't edit another.

  function updateConsultant(changes: ConsultantProfileChanges) {
    if (user?.role !== 'consultant') return 'Only consultants can change these details.';
    setUsers((prev) => prev.map((u) => (u.id === user.id && u.role === 'consultant' ? { ...u, ...changes } : u)));
    return null;
  }

  function updateOwnProfile({ name, phone, city }: OwnProfileChanges) {
    if (!user) return 'Please log in again.';
    if (name.trim().length < 2) return 'Enter your full name.';
    if (phone.replace(/\D/g, '').length < 7) return 'Enter a valid phone number.';
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== user.id) return u;
        const base = { ...u, name: name.trim(), phone: phone.trim() };
        return base.role === 'client' && city ? { ...base, city } : base;
      }),
    );
    return null;
  }

  /** Add a review to (1) or take one out of (-1) a consultant's average rating and count. */
  function adjustRating(consultantId: string, rating: number, change: 1 | -1) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === consultantId && u.role === 'consultant'
          ? { ...u, ...adjustAverage(u.rating, u.reviewCount, rating, change) }
          : u,
      ),
    );
  }

  // Admin actions. They check the signed-in role themselves, not just rely on the screens being admin-only.

  function setVerification(consultantId: string, verification: VerificationStatus) {
    if (user?.role !== 'admin') return 'Only an administrator can do this.';
    if (!users.some((u) => u.id === consultantId && u.role === 'consultant')) return 'Consultant not found.';
    setUsers((prev) => prev.map((u) => (u.id === consultantId && u.role === 'consultant' ? { ...u, verification } : u)));
    return null;
  }

  function setAccountStatus(userId: string, status: AccountStatus) {
    if (user?.role !== 'admin') return 'Only an administrator can do this.';
    const target = users.find((u) => u.id === userId);
    if (!target) return 'User not found.';
    if (target.role === 'admin') return 'Administrator accounts can’t be suspended here.';
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        signIn,
        signUp,
        signOut,
        pendingMfa,
        security: session && { mfaEnabled: session.mfaEnabled, mfaRequired: session.mfaRequired },
        verifyMfa,
        completeSignIn,
        cancelMfa,
        startMfaSetup,
        confirmMfaSetup,
        getMfaStatus,
        regenerateRecoveryCodes,
        disableMfa,
        updateConsultant,
        updateOwnProfile,
        adjustRating,
        setVerification,
        setAccountStatus,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

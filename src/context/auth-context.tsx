import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  ApiError,
  authApi,
  errorMessage,
  type ApiUser,
  type EmailSent,
  type LoginFactor,
  type LoginResponse,
  type MfaChallenge,
  type MfaEnableResponse,
  type MfaSetupData,
  type MfaStatus,
  type MfaVerifyResponse,
  type SecondFactor,
} from '@/api/auth-api';
import { dataApi, type ServiceInput } from '@/api/data-api';
import { seedUsers } from '@/data/users';
import type { AccountStatus, Consultant, User, VerificationStatus } from '@/data/types';
import { useSavedState } from '@/hooks/use-saved-state';
import { loadSession, saveSession } from '@/storage/local-store';
import { shrinkPhoto } from '@/utils/photos';
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

/** Fields a consultant can change themselves: profile and availability. Services have their own routes. */
export type ConsultantProfileChanges = Partial<
  Pick<Consultant, 'title' | 'categoryId' | 'bio' | 'hourlyRate' | 'location' | 'qualifications' | 'availability'>
>;

/** Contact details any user can change. `city` applies to clients only. */
export interface OwnProfileChanges {
  name: string;
  phone: string;
  city?: string;
  /** A newly picked photo (a file on this device, uploaded on save), or null to remove it. Leave out to keep the current one. */
  avatarUri?: string | null;
}

/** Where to go after a password: signed in, or the screen for the emailed (or authenticator) code. */
export type AuthResult = { error: string } | { next: 'done' | 'mfa-verify' };

/** Password accepted, a code still to enter. */
export type PendingMfa = Omit<MfaChallenge, 'status'>;

interface Session {
  token: string;
  /** Two-step verification on (email or authenticator). */
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

interface AuthContextValue {
  user: User | null;
  /** Accounts this user may see (from the server, cached on the device). */
  users: User[];
  /** Session token for the data API, or null when logged out. */
  token: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  signOut: () => void;
  /** Reloads `users` from the server. Throws ApiError, e.g. when offline. */
  refreshUsers: () => Promise<void>;
  /** Reloads one user (e.g. a consultant whose rating changed). */
  refreshUser: (id: string) => Promise<void>;

  // Multi-factor authentication. These throw ApiError; show it with errorMessage().
  pendingMfa: PendingMfa | null;
  /** MFA state of the signed-in account. */
  security: { mfaEnabled: boolean; mfaRequired: boolean } | null;
  verifyMfa: (factor: LoginFactor) => Promise<MfaVerifyResponse>;
  /** Emails a new login code for the pending login. */
  sendLoginCode: () => Promise<EmailSent>;
  /** Opens the session from verifyMfa / confirmMfaSetup. Separate so screens can show a notice first. */
  completeSignIn: (result: { token?: string; user: ApiUser }) => void;
  cancelMfa: () => void;
  /** New secret to scan. `reauth` only when replacing an authenticator that's already on. */
  startMfaSetup: (reauth?: { password: string } & SecondFactor) => Promise<MfaSetupData>;
  confirmMfaSetup: (code: string) => Promise<MfaEnableResponse>;
  getMfaStatus: () => Promise<MfaStatus>;
  regenerateRecoveryCodes: (code: string) => Promise<string[]>;
  disableMfa: (password: string, factor: SecondFactor) => Promise<void>;
  /** Clients: emailed login codes. Turning on sends a code to confirm the address. */
  startEmailMfa: () => Promise<EmailSent>;
  enableEmailMfa: (emailCode: string) => Promise<void>;
  disableEmailMfa: (password: string) => Promise<void>;

  // These resolve to an error message for the screen to show, or null on success.

  /** Signed-in consultant only. */
  updateConsultant: (changes: ConsultantProfileChanges) => Promise<string | null>;
  /** Signed-in user's name, phone, photo (and city for clients). */
  updateOwnProfile: (changes: OwnProfileChanges) => Promise<string | null>;
  /** Signed-in consultant adds (editingId null) or edits one of their services. */
  saveService: (input: ServiceInput, editingId: string | null) => Promise<string | null>;
  deleteService: (serviceId: string) => Promise<string | null>;
  /** Admin only. */
  setVerification: (consultantId: string, verification: VerificationStatus) => Promise<string | null>;
  /** Admin only. Suspending also signs the user out on the server. */
  setAccountStatus: (userId: string, status: AccountStatus) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const noSession = () => new ApiError('Please log in again.', 'unauthorized', 401);

/** Two-step verification is on: by email, an authenticator app, or both. */
const twoStepOn = (u: ApiUser) => u.mfaEnabled || u.emailMfaEnabled;

// Passwords, sessions, MFA, profiles and admin actions go through the SaveMan API (backend/), which
// checks each caller's role. Accounts are cached on this device (SQLite) and the session is kept in
// secure storage, so the app reopens logged in and the saved data stays usable offline.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useSavedState<User[]>('users', seedUsers);
  const [saved] = useState(loadSession);
  const [userId, setUserId] = useState<string | null>(saved?.userId ?? null);
  const [session, setSession] = useState<Session | null>(
    saved && { token: saved.token, mfaEnabled: saved.mfaEnabled, mfaRequired: saved.mfaRequired },
  );
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);

  const user = users.find((u) => u.id === userId) ?? null;
  const token = session?.token ?? null;

  useEffect(() => {
    saveSession(session && userId ? { userId, ...session } : null);
  }, [session, userId]);

  // A reopened session is checked with the server when online. Offline, it's kept so the saved data
  // stays usable; a session the server rejects (expired, suspended) logs out.
  useEffect(() => {
    if (!saved) return;
    authApi
      .mfaStatus(saved.token)
      .then((status) => setSession((s) => (s?.token === saved.token ? { ...s, mfaEnabled: status.enabled || status.emailEnabled } : s)))
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setSession((s) => (s?.token === saved.token ? null : s));
          setUserId((id) => (id === saved.userId ? null : id));
        }
      });
  }, [saved]);

  const replaceUser = useCallback(
    (updated: User) => setUsers((prev) => (prev.some((u) => u.id === updated.id) ? prev.map((u) => (u.id === updated.id ? updated : u)) : [...prev, updated])),
    [setUsers],
  );

  /** Fetches the accounts this user may see. Throws ApiError (e.g. when offline). */
  const refreshUsers = useCallback(async () => {
    const list = await dataApi.users.list(token);
    // Keep the signed-in profile if the server didn't send it (it always should).
    setUsers((prev) => {
      const me = prev.find((u) => u.id === userId);
      return me && !list.some((u) => u.id === me.id) ? [...list, me] : list;
    });
  }, [token, userId, setUsers]);

  const refreshUser = useCallback(
    async (id: string) => {
      try {
        replaceUser(await dataApi.users.get(token, id));
      } catch {}
    },
    [token, replaceUser],
  );

  function sessionToken() {
    if (!session) throw noSession();
    return session.token;
  }

  function afterPassword(res: LoginResponse): AuthResult {
    if (res.status === 'ok') {
      completeSignIn(res);
      return { next: 'done' };
    }
    const { status: _status, ...pending } = res;
    setPendingMfa(pending);
    return { next: 'mfa-verify' };
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
      const res = await authApi.register({
        role: input.role,
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
        phone: input.phone.trim(),
        city: input.city,
        ...(input.role === 'consultant' && { title: input.title?.trim(), categoryId: input.categoryId }),
      });
      return afterPassword(res);
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }

  function completeSignIn({ token: newToken, user: apiUser }: { token?: string; user: ApiUser }) {
    if (!newToken) return;
    setSession({ token: newToken, mfaEnabled: twoStepOn(apiUser), mfaRequired: apiUser.mfaRequired });
    setPendingMfa(null);
    // The root layout switches to the user's section once their profile is here.
    if (users.some((u) => u.id === apiUser.id)) setUserId(apiUser.id);
    authApi
      .me(newToken)
      .then(({ mfaEnabled: _mfa, ...profile }) => {
        replaceUser(profile as User);
        setUserId(profile.id);
      })
      .catch(() => {});
  }

  function cancelMfa() {
    if (pendingMfa) authApi.logout(pendingMfa.mfaToken).catch(() => {});
    setPendingMfa(null);
  }

  function verifyMfa(factor: LoginFactor) {
    if (!pendingMfa) throw noSession();
    return authApi.verifyMfa(pendingMfa.mfaToken, factor);
  }

  async function sendLoginCode() {
    if (!pendingMfa) throw noSession();
    const sent = await authApi.sendLoginCode(pendingMfa.mfaToken);
    setPendingMfa((p) => p && { ...p, email: sent, emailError: undefined });
    return sent;
  }

  function startMfaSetup(reauth?: { password: string } & SecondFactor) {
    return authApi.mfaSetup(sessionToken(), reauth);
  }

  async function confirmMfaSetup(code: string) {
    const res = await authApi.mfaEnable(sessionToken(), code);
    setSession((s) => (s ? { ...s, mfaEnabled: true } : s));
    return res;
  }

  function startEmailMfa() {
    return authApi.startEmailMfa(sessionToken());
  }

  async function enableEmailMfa(emailCode: string) {
    const res = await authApi.enableEmailMfa(sessionToken(), emailCode);
    setSession((s) => (s ? { ...s, mfaEnabled: twoStepOn(res.user) } : s));
  }

  async function disableEmailMfa(password: string) {
    const res = await authApi.disableEmailMfa(sessionToken(), password);
    setSession((s) => (s ? { ...s, mfaEnabled: twoStepOn(res.user) } : s));
  }

  function getMfaStatus() {
    return authApi.mfaStatus(sessionToken());
  }

  async function regenerateRecoveryCodes(code: string) {
    return (await authApi.regenerateRecoveryCodes(sessionToken(), code)).recoveryCodes;
  }

  async function disableMfa(password: string, factor: SecondFactor) {
    const res = await authApi.disableMfa(sessionToken(), password, factor);
    setSession((s) => (s ? { ...s, mfaEnabled: twoStepOn(res.user) } : s));
  }

  const signOut = useCallback(() => {
    if (session) authApi.logout(session.token).catch(() => {});
    setSession(null);
    setPendingMfa(null);
    setUserId(null);
  }, [session]);

  /** Runs an API call that returns the changed user, and stores it. Returns an error message, or null. */
  async function saveUser(call: (token: string) => Promise<User>) {
    if (!session) return 'Please log in again.';
    try {
      replaceUser(await call(session.token));
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  // Profile changes apply to the signed-in user; the server refuses edits to anyone else's.

  function updateConsultant(changes: ConsultantProfileChanges) {
    if (user?.role !== 'consultant') return Promise.resolve('Only consultants can change these details.');
    return saveUser((t) => dataApi.users.updateProfile(t, user.id, changes));
  }

  async function updateOwnProfile({ name, phone, city, avatarUri }: OwnProfileChanges) {
    if (!user) return 'Please log in again.';
    if (name.trim().length < 2) return 'Enter your full name.';
    if (phone.replace(/\D/g, '').length < 7) return 'Enter a valid phone number.';
    // A new photo is shrunk and uploaded first, so everyone sees it, not just this phone.
    if (avatarUri && avatarUri !== user.avatarUri) {
      let image;
      try {
        image = await shrinkPhoto(avatarUri);
      } catch {
        return 'That photo couldn’t be read. Try a different one.';
      }
      const error = await saveUser((t) => dataApi.users.uploadPhoto(t, user.id, image));
      if (error) return error;
    }
    const changes = { name: name.trim(), phone: phone.trim(), ...(user.role === 'client' && city && { city }), ...(avatarUri === null && { avatarUri: null }) };
    return saveUser((t) => dataApi.users.updateProfile(t, user.id, changes));
  }

  function saveService(input: ServiceInput, editingId: string | null) {
    if (user?.role !== 'consultant') return Promise.resolve('Only consultants have services.');
    return saveUser(async (t) => (editingId ? await dataApi.services.update(t, editingId, input) : await dataApi.services.create(t, input)).user);
  }

  function deleteService(serviceId: string) {
    if (user?.role !== 'consultant') return Promise.resolve('Only consultants have services.');
    return saveUser(async (t) => (await dataApi.services.remove(t, serviceId)).user);
  }

  // Admin actions. The server checks the role too; these checks just give a quicker message.

  function setVerification(consultantId: string, verification: VerificationStatus) {
    if (user?.role !== 'admin') return Promise.resolve('Only an administrator can do this.');
    return saveUser((t) => dataApi.users.setVerification(t, consultantId, verification));
  }

  function setAccountStatus(targetId: string, status: AccountStatus) {
    if (user?.role !== 'admin') return Promise.resolve('Only an administrator can do this.');
    return saveUser((t) => dataApi.users.setStatus(t, targetId, status));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        token,
        signIn,
        signUp,
        signOut,
        refreshUsers,
        refreshUser,
        pendingMfa,
        security: session && { mfaEnabled: session.mfaEnabled, mfaRequired: session.mfaRequired },
        verifyMfa,
        sendLoginCode,
        completeSignIn,
        cancelMfa,
        startMfaSetup,
        confirmMfaSetup,
        getMfaStatus,
        regenerateRecoveryCodes,
        disableMfa,
        startEmailMfa,
        enableEmailMfa,
        disableEmailMfa,
        updateConsultant,
        updateOwnProfile,
        saveService,
        deleteService,
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

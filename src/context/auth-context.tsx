import { createContext, useContext, useState, type ReactNode } from 'react';

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

interface AuthContextValue {
  user: User | null;
  users: User[];
  signIn: (email: string, password: string) => string | null;
  signUp: (input: SignUpInput) => string | null;
  signOut: () => void;
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

// In-memory only: accounts created at sign-up reset when the app reloads.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [userId, setUserId] = useState<string | null>(null);

  const user = users.find((u) => u.id === userId) ?? null;

  // Both return an error message, or null on success.
  function signIn(email: string, password: string) {
    const match = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!match || match.password !== password) return 'Incorrect email or password.';
    if (match.status === 'suspended') return 'This account has been suspended. Contact SaveMan support.';
    setUserId(match.id);
    return null;
  }

  function signUp(input: SignUpInput) {
    const email = input.email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return 'An account with this email already exists.';
    }

    const base = {
      id: `u-${Date.now()}`,
      name: input.name.trim(),
      email,
      password: input.password,
      phone: input.phone.trim(),
      status: 'active' as const,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    let created: User;
    if (input.role === 'client') {
      created = { ...base, role: 'client', city: input.city } satisfies Client;
    } else {
      // Start at the chosen town centre; the consultant can set their exact office pin later.
      const place = Object.values(places).find((p) => p.city === input.city) ?? places.portMoresby;
      const location = { ...place, address: '' };
      created = {
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
        location,
        verification: 'pending', // new consultants wait for admin approval
        rating: 0,
        reviewCount: 0,
      } satisfies Consultant;
    }

    setUsers((prev) => [...prev, created]);
    setUserId(created.id);
    return null;
  }

  function signOut() {
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

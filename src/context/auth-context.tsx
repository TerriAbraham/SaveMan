import { createContext, useContext, useState, type ReactNode } from 'react';

import { places, seedUsers, standardWeek } from '@/data/users';
import type { Client, Consultant, User } from '@/data/types';

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
  Pick<Consultant, 'title' | 'bio' | 'hourlyRate' | 'location' | 'services' | 'availability'>
>;

interface AuthContextValue {
  user: User | null;
  users: User[];
  signIn: (email: string, password: string) => string | null;
  signUp: (input: SignUpInput) => string | null;
  signOut: () => void;
  updateConsultant: (id: string, changes: ConsultantProfileChanges) => void;
  recordRating: (consultantId: string, rating: number) => void;
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

  function updateConsultant(id: string, changes: ConsultantProfileChanges) {
    setUsers((prev) => prev.map((u) => (u.id === id && u.role === 'consultant' ? { ...u, ...changes } : u)));
  }

  /** Fold a new review into the consultant's average rating and count. */
  function recordRating(consultantId: string, rating: number) {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== consultantId || u.role !== 'consultant') return u;
        const reviewCount = u.reviewCount + 1;
        // Keep one decimal place, as shown in the app.
        const average = Math.round(((u.rating * u.reviewCount + rating) / reviewCount) * 10) / 10;
        return { ...u, rating: average, reviewCount };
      }),
    );
  }

  return (
    <AuthContext.Provider value={{ user, users, signIn, signUp, signOut, updateConsultant, recordRating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

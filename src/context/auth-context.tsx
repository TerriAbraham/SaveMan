import { createContext, useContext, useState, type ReactNode } from 'react';

import { places, seedUsers } from '@/data/users';
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

interface AuthContextValue {
  user: User | null;
  users: User[];
  signIn: (email: string, password: string) => string | null;
  signUp: (input: SignUpInput) => string | null;
  signOut: () => void;
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
      const location = Object.values(places).find((p) => p.city === input.city) ?? places.portMoresby;
      created = {
        ...base,
        role: 'consultant',
        title: input.title?.trim() ?? '',
        categoryId: input.categoryId ?? '',
        bio: '',
        expertise: [],
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

  return (
    <AuthContext.Provider value={{ user, users, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

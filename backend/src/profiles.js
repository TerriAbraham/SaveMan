import { places, standardWeek } from '../../src/data/users.ts';

/** Columns kept in the users table; everything else about a user is in their profile (profiles.data). */
const ACCOUNT_FIELDS = ['id', 'name', 'email', 'role', 'status', 'password'];

/** The profile part of an app User (src/data/types.ts). */
export function profileOf(user) {
  return Object.fromEntries(Object.entries(user).filter(([k]) => !ACCOUNT_FIELDS.includes(k)));
}

/**
 * A new account's profile. Consultants start unverified with an empty profile at their town centre;
 * they set their exact office pin, services and prices later.
 */
export function newProfile(role, { phone = '', city = '', title = '', categoryId = '' } = {}, createdAtMs = Date.now()) {
  const base = { phone, createdAt: new Date(createdAtMs).toISOString().slice(0, 10) };
  if (role === 'admin') return base;
  if (role === 'client') return { ...base, city };
  const place = Object.values(places).find((p) => p.city === city) ?? places.portMoresby;
  return {
    ...base,
    title,
    categoryId,
    bio: '',
    expertise: [],
    qualifications: [],
    services: [],
    availability: standardWeek,
    hourlyRate: 0,
    yearsExperience: 0,
    languages: ['English'],
    location: { ...place, address: '' },
    verification: 'pending',
    rating: 0,
    reviewCount: 0,
  };
}

/** A user row plus profile, shaped like the app's User type. The password never leaves the server. */
export function toUser(row, profile) {
  return { ...profile, id: row.id, name: row.name, email: row.email, role: row.role, status: row.status, password: '' };
}

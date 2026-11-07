import type { Booking, Category, Consultant, Conversation, Message, Review, Service, User } from '@/data/types';

import { request } from './auth-api';

// REST endpoints for the app's data (backend/src/resources.js). The server checks every caller's
// role, so these work the same whichever screen calls them. `token` is the session token, or null
// for the routes anyone can read.

type Token = string | null;

export interface ServiceInput {
  name: string;
  description: string;
  durationMins: number;
  price: number;
}

export interface BookingInput {
  consultantId: string;
  serviceId: string;
  date: string;
  time: string;
  mode: Booking['mode'];
  note: string;
}

/** A booked time with a consultant, without who booked it. Enough for getSlots(). */
export type BusyTime = Pick<Booking, 'id' | 'consultantId' | 'date' | 'time' | 'durationMins' | 'status'>;

/** Fields a user can change on their own profile. */
export type ProfileChanges = Partial<
  Pick<Consultant, 'name' | 'phone' | 'title' | 'categoryId' | 'bio' | 'hourlyRate' | 'location' | 'qualifications' | 'availability'>
> & { city?: string; avatarUri?: string | null };

export const dataApi = {
  users: {
    list: (token: Token) => request<User[]>('GET', '/api/users', undefined, token),
    get: (token: Token, id: string) => request<User>('GET', `/api/users/${encodeURIComponent(id)}`, undefined, token),
    updateProfile: (token: string, id: string, changes: ProfileChanges) =>
      request<User>('PATCH', `/api/users/${encodeURIComponent(id)}`, changes, token),
    /** A consultant's booked times (no client details), for offering free slots. */
    busy: (token: string, id: string) => request<BusyTime[]>('GET', `/api/users/${encodeURIComponent(id)}/busy`, undefined, token),
    /** Your own profile photo, as a base64 JPEG (see shrinkPhoto). */
    uploadPhoto: (token: string, id: string, image: string) =>
      request<User>('POST', `/api/users/${encodeURIComponent(id)}/photo`, { image }, token),
    /** Admin only: a one-time code for someone who forgot their password. */
    createResetCode: (token: string, id: string) =>
      request<{ code: string; expiresAt: number }>('POST', `/api/users/${encodeURIComponent(id)}/reset-code`, undefined, token),
    /** Admin only. */
    setStatus: (token: string, id: string, status: User['status']) =>
      request<User>('PATCH', `/api/users/${encodeURIComponent(id)}`, { status }, token),
    /** Admin only. */
    setVerification: (token: string, id: string, verification: Consultant['verification']) =>
      request<User>('PATCH', `/api/users/${encodeURIComponent(id)}`, { verification }, token),
  },
  /** The signed-in consultant's own services. */
  services: {
    create: (token: string, input: ServiceInput) => request<{ service: Service; user: User }>('POST', '/api/services', input, token),
    update: (token: string, id: string, input: Partial<ServiceInput>) =>
      request<{ service: Service; user: User }>('PATCH', `/api/services/${encodeURIComponent(id)}`, input, token),
    remove: (token: string, id: string) => request<{ user: User }>('DELETE', `/api/services/${encodeURIComponent(id)}`, undefined, token),
  },
  categories: {
    list: () => request<Category[]>('GET', '/api/categories'),
    /** Admin only, like update and remove. */
    create: (token: string, draft: Omit<Category, 'id'>) => request<Category>('POST', '/api/categories', draft, token),
    update: (token: string, id: string, draft: Omit<Category, 'id'>) =>
      request<Category>('PATCH', `/api/categories/${encodeURIComponent(id)}`, draft, token),
    remove: (token: string, id: string) => request<void>('DELETE', `/api/categories/${encodeURIComponent(id)}`, undefined, token),
  },
  bookings: {
    list: (token: string) => request<Booking[]>('GET', '/api/bookings', undefined, token),
    /** Client only. */
    create: (token: string, input: BookingInput) => request<Booking>('POST', '/api/bookings', input, token),
    /** Client: 'cancelled'. Consultant: 'confirmed', 'declined' or 'completed'. */
    setStatus: (token: string, id: string, status: Booking['status']) =>
      request<Booking>('PATCH', `/api/bookings/${encodeURIComponent(id)}`, { status }, token),
  },
  reviews: {
    list: (token: Token) => request<Review[]>('GET', '/api/reviews', undefined, token),
    /** Client only. */
    create: (token: string, input: Pick<Review, 'bookingId' | 'rating' | 'comment'>) => request<Review>('POST', '/api/reviews', input, token),
    /** Admin only: hide or restore. */
    setRemoved: (token: string, id: string, removed: boolean) =>
      request<Review>('PATCH', `/api/reviews/${encodeURIComponent(id)}`, { removed }, token),
  },
  conversations: {
    list: (token: string) => request<Conversation[]>('GET', '/api/conversations', undefined, token),
    markRead: (token: string, id: string) => request<Conversation>('PATCH', `/api/conversations/${encodeURIComponent(id)}`, { read: true }, token),
  },
  messages: {
    list: (token: string) => request<Message[]>('GET', '/api/messages', undefined, token),
    send: (token: string, recipientId: string, text: string) =>
      request<{ conversation: Conversation; message: Message }>('POST', '/api/messages', { recipientId, text }, token),
  },
};

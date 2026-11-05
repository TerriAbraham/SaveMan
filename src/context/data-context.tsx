import { createContext, useContext, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { bookings as seedBookings, conversations as seedConversations, messages as seedMessages, reviews as seedReviews } from '@/data/activity';
import { categories as seedCategories } from '@/data/categories';
import type { Booking, Category, Conversation, Message, Review } from '@/data/types';
import { getSlots, isUpcoming } from '@/utils/availability';
import { canAccept, canComplete, canDecline, canReview, hasStarted } from '@/utils/booking-rules';
import { validateCategory } from '@/utils/categories';
import { toLocalDateTime } from '@/utils/dates';

/** What a client chooses on the booking screen. Everything else comes from the store. */
export interface BookingRequest {
  consultantId: string;
  serviceId: string;
  date: string;
  time: string;
  mode: Booking['mode'];
  note: string;
}
export type BookingResponse = 'accept' | 'decline' | 'complete';
export type NewReview = Pick<Review, 'bookingId' | 'rating' | 'comment'>;
export type CategoryDraft = Pick<Category, 'name' | 'description'>;

// Actions return an error message for the screen to show, or null on success.
// Each one checks the signed-in user itself rather than trusting the caller.
interface DataContextValue {
  bookings: Booking[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  categories: Category[];
  createBooking: (request: BookingRequest) => { booking: Booking; error?: never } | { booking?: never; error: string };
  /** Client cancels their own upcoming booking. */
  cancelBooking: (bookingId: string) => string | null;
  /** Consultant accepts, declines or completes one of their bookings. */
  respondToBooking: (bookingId: string, response: BookingResponse) => string | null;
  /** Client reviews their own completed booking, once. */
  addReview: (input: NewReview) => string | null;
  /** Admin: hide a review and take it out of the rating. */
  removeReview: (reviewId: string) => string | null;
  /** Admin: undo a removal. */
  restoreReview: (reviewId: string) => string | null;
  /** Message between the signed-in user and `otherId` (client <-> consultant only). */
  sendMessage: (otherId: string, text: string) => string | null;
  markConversationRead: (conversationId: string) => void;
  /** Admin category management. */
  saveCategory: (draft: CategoryDraft, editingId: string | null) => string | null;
  deleteCategory: (categoryId: string) => string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

let nextId = 1;
const newId = (prefix: string) => `${prefix}-new-${Date.now()}-${nextId++}`;

// In-memory only, like auth: changes reset when the app reloads.
// It sits above the auth screens so data survives logging out and in as another role.
export function DataProvider({ children }: { children: ReactNode }) {
  const { user, users, adjustRating } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [reviews, setReviews] = useState<Review[]>(seedReviews);
  const [conversations, setConversations] = useState<Conversation[]>(seedConversations);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [categories, setCategories] = useState<Category[]>(seedCategories);

  function createBooking(request: BookingRequest) {
    if (user?.role !== 'client') return { error: 'Only clients can book sessions.' };
    const consultant = users.find((u) => u.id === request.consultantId);
    if (consultant?.role !== 'consultant' || consultant.verification !== 'verified' || consultant.status !== 'active') {
      return { error: 'This consultant is not taking bookings right now.' };
    }
    const service = consultant.services.find((s) => s.id === request.serviceId);
    if (!service) return { error: 'That service is no longer offered. Please choose another.' };
    // Re-check the slot here: it may have been taken since the screen was drawn.
    const slot = getSlots(consultant, request.date, service.durationMins, bookings).find((s) => s.time === request.time);
    if (!slot?.available) return { error: 'That time is no longer available. Please pick another.' };

    // New requests wait for the consultant to accept them. Price and length are copied
    // so later service edits don't change an existing booking.
    const booking: Booking = {
      id: newId('b'),
      clientId: user.id,
      consultantId: consultant.id,
      serviceName: service.name,
      date: request.date,
      time: request.time,
      durationMins: service.durationMins,
      mode: request.mode,
      note: request.note.trim(),
      status: 'pending',
      price: service.price,
    };
    setBookings((prev) => [...prev, booking]);
    return { booking };
  }

  function cancelBooking(bookingId: string) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.clientId !== user?.id) return 'Booking not found.';
    if (!isUpcoming(booking) || hasStarted(booking)) return 'Only upcoming sessions can be cancelled.';
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)));
    return null;
  }

  function respondToBooking(bookingId: string, response: BookingResponse) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || user?.role !== 'consultant' || booking.consultantId !== user.id) return 'Booking not found.';
    const rules = {
      accept: { allowed: canAccept(booking), status: 'confirmed', error: 'Only upcoming requests can be accepted.' },
      decline: { allowed: canDecline(booking), status: 'declined', error: 'Only requests can be declined.' },
      complete: {
        allowed: canComplete(booking),
        status: 'completed',
        error: 'A session can be marked completed once it has started.',
      },
    } as const;
    const rule = rules[response];
    if (!rule.allowed) return rule.error;
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: rule.status } : b)));
    return null;
  }

  function addReview({ bookingId, rating, comment }: NewReview) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || !user || !canReview(booking, reviews, user.id)) {
      return 'You can review a session once, after it has been completed.';
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Choose a rating from 1 to 5 stars.';
    const review: Review = {
      id: newId('r'),
      bookingId,
      clientId: user.id,
      consultantId: booking.consultantId,
      rating,
      comment: comment.trim().slice(0, 500),
      createdAt: toLocalDateTime(new Date()).slice(0, 10),
    };
    setReviews((prev) => [...prev, review]);
    adjustRating(booking.consultantId, rating, 1);
    return null;
  }

  function moderateReview(reviewId: string, remove: boolean) {
    if (user?.role !== 'admin') return 'Only an administrator can do this.';
    const review = reviews.find((r) => r.id === reviewId);
    if (!review) return 'Review not found.';
    if (Boolean(review.removedAt) === remove) return remove ? 'This review is already removed.' : 'This review is already visible.';
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, removedAt: remove ? toLocalDateTime(new Date()) : undefined } : r)),
    );
    adjustRating(review.consultantId, review.rating, remove ? -1 : 1);
    return null;
  }

  function sendMessage(otherId: string, text: string) {
    const other = users.find((u) => u.id === otherId);
    const body = text.trim();
    if (!user || !other) return 'Conversation not available.';
    const pair =
      user.role === 'client' && other.role === 'consultant'
        ? { clientId: user.id, consultantId: other.id }
        : user.role === 'consultant' && other.role === 'client'
          ? { clientId: other.id, consultantId: user.id }
          : null;
    if (!pair) return 'Clients and consultants can only message each other.';
    if (body === '') return 'Write a message first.';
    if (body.length > 1000) return 'Messages can be up to 1000 characters.';

    // A conversation is created with its first message. New ids are derived from the
    // pair, so two quick sends can never create two conversations.
    const existing = conversations.find((c) => c.clientId === pair.clientId && c.consultantId === pair.consultantId);
    const conversationId = existing?.id ?? `c-${pair.clientId}-${pair.consultantId}`;
    if (!existing) {
      setConversations((prev) => (prev.some((c) => c.id === conversationId) ? prev : [...prev, { id: conversationId, ...pair }]));
    }
    const message: Message = {
      id: newId('m'),
      conversationId,
      senderId: user.id,
      text: body,
      sentAt: toLocalDateTime(new Date()),
      read: false,
    };
    setMessages((prev) => [...prev, message]);
    return null;
  }

  function markConversationRead(conversationId: string) {
    if (!user) return;
    setMessages((prev) =>
      prev.some((m) => m.conversationId === conversationId && m.senderId !== user.id && !m.read)
        ? prev.map((m) => (m.conversationId === conversationId && m.senderId !== user.id ? { ...m, read: true } : m))
        : prev,
    );
  }

  function saveCategory(draft: CategoryDraft, editingId: string | null) {
    if (user?.role !== 'admin') return 'Only an administrator can do this.';
    const errors = validateCategory(draft, categories, editingId);
    const first = errors.name ?? errors.description;
    if (first) return first;
    const category: Category = { id: editingId ?? newId('cat'), name: draft.name.trim(), description: draft.description.trim() };
    setCategories((prev) => (editingId ? prev.map((c) => (c.id === editingId ? category : c)) : [...prev, category]));
    return null;
  }

  function deleteCategory(categoryId: string) {
    if (user?.role !== 'admin') return 'Only an administrator can do this.';
    const inUse = users.filter((u) => u.role === 'consultant' && u.categoryId === categoryId).length;
    if (inUse > 0) {
      return `${inUse} consultant${inUse > 1 ? 's use' : ' uses'} this category. Move them to another category first.`;
    }
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    return null;
  }

  return (
    <DataContext.Provider
      value={{
        bookings,
        reviews,
        conversations,
        messages,
        categories,
        createBooking,
        cancelBooking,
        respondToBooking,
        addReview,
        removeReview: (id) => moderateReview(id, true),
        restoreReview: (id) => moderateReview(id, false),
        sendMessage,
        markConversationRead,
        saveCategory,
        deleteCategory,
      }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

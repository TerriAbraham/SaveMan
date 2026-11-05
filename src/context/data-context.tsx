import { createContext, useContext, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { bookings as seedBookings, conversations as seedConversations, messages as seedMessages, reviews as seedReviews } from '@/data/activity';
import type { Booking, Conversation, Message, Review } from '@/data/types';
import { canAccept, canComplete, canDecline, canReview } from '@/utils/booking-rules';
import { toLocalDateTime } from '@/utils/dates';

export type NewBooking = Omit<Booking, 'id' | 'status'>;
export type BookingResponse = 'accept' | 'decline' | 'complete';
export type NewReview = Pick<Review, 'bookingId' | 'clientId' | 'rating' | 'comment'>;

interface DataContextValue {
  bookings: Booking[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  createBooking: (input: NewBooking) => Booking;
  cancelBooking: (bookingId: string) => void;
  /** Consultant actions on a booking. Returns an error message, or null on success. */
  respondToBooking: (bookingId: string, consultantId: string, response: BookingResponse) => string | null;
  /** Returns an error message, or null on success. */
  addReview: (input: NewReview) => string | null;
  /** Admin only: hide a review and take it out of the rating. Returns an error message, or null. */
  removeReview: (reviewId: string) => string | null;
  /** Admin only: undo a removal. Returns an error message, or null. */
  restoreReview: (reviewId: string) => string | null;
  sendMessage: (input: { clientId: string; consultantId: string; senderId: string; text: string }) => void;
  markConversationRead: (conversationId: string, readerId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

let nextId = 1;
const newId = (prefix: string) => `${prefix}-new-${Date.now()}-${nextId++}`;

// In-memory only, like auth: changes reset when the app reloads.
// It sits above the auth screens so data survives logging out and in as another role.
export function DataProvider({ children }: { children: ReactNode }) {
  const { user, adjustRating } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [reviews, setReviews] = useState<Review[]>(seedReviews);
  const [conversations, setConversations] = useState<Conversation[]>(seedConversations);
  const [messages, setMessages] = useState<Message[]>(seedMessages);

  function createBooking(input: NewBooking) {
    // New requests wait for the consultant to accept them.
    const booking: Booking = { ...input, id: newId('b'), status: 'pending' };
    setBookings((prev) => [...prev, booking]);
    return booking;
  }

  function cancelBooking(bookingId: string) {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)));
  }

  function respondToBooking(bookingId: string, consultantId: string, response: BookingResponse) {
    const booking = bookings.find((b) => b.id === bookingId && b.consultantId === consultantId);
    if (!booking) return 'Booking not found.';
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

  function addReview({ bookingId, clientId, rating, comment }: NewReview) {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || !canReview(booking, reviews, clientId)) {
      return 'You can review a session once, after it has been completed.';
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Choose a rating from 1 to 5 stars.';
    const review: Review = {
      id: newId('r'),
      bookingId,
      clientId,
      consultantId: booking.consultantId,
      rating,
      comment: comment.trim(),
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

  function sendMessage({ clientId, consultantId, senderId, text }: { clientId: string; consultantId: string; senderId: string; text: string }) {
    // A conversation is created with its first message. New ids are derived from the
    // pair, so two quick sends can never create two conversations.
    const existing = conversations.find((c) => c.clientId === clientId && c.consultantId === consultantId);
    const conversationId = existing?.id ?? `c-${clientId}-${consultantId}`;
    if (!existing) {
      setConversations((prev) =>
        prev.some((c) => c.id === conversationId) ? prev : [...prev, { id: conversationId, clientId, consultantId }],
      );
    }
    const message: Message = {
      id: newId('m'),
      conversationId,
      senderId,
      text: text.trim(),
      sentAt: toLocalDateTime(new Date()),
      read: false,
    };
    setMessages((prev) => [...prev, message]);
  }

  function markConversationRead(conversationId: string, readerId: string) {
    setMessages((prev) =>
      prev.some((m) => m.conversationId === conversationId && m.senderId !== readerId && !m.read)
        ? prev.map((m) => (m.conversationId === conversationId && m.senderId !== readerId ? { ...m, read: true } : m))
        : prev,
    );
  }

  return (
    <DataContext.Provider
      value={{
        bookings,
        reviews,
        conversations,
        messages,
        createBooking,
        cancelBooking,
        respondToBooking,
        addReview,
        removeReview: (id) => moderateReview(id, true),
        restoreReview: (id) => moderateReview(id, false),
        sendMessage,
        markConversationRead,
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

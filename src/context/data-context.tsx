import { createContext, useContext, useState, type ReactNode } from 'react';

import { bookings as seedBookings, conversations as seedConversations, messages as seedMessages, reviews as seedReviews } from '@/data/activity';
import type { Booking, Conversation, Message, Review } from '@/data/types';
import { toLocalDateTime } from '@/utils/dates';

export type NewBooking = Omit<Booking, 'id' | 'status'>;

interface DataContextValue {
  bookings: Booking[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  createBooking: (input: NewBooking) => Booking;
  cancelBooking: (bookingId: string) => void;
  sendMessage: (input: { clientId: string; consultantId: string; senderId: string; text: string }) => void;
  markConversationRead: (conversationId: string, readerId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

let nextId = 1;
const newId = (prefix: string) => `${prefix}-new-${Date.now()}-${nextId++}`;

// In-memory only, like auth: changes reset when the app reloads.
// It sits above the auth screens so data survives logging out and in as another role.
export function DataProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(seedBookings);
  const [reviews] = useState<Review[]>(seedReviews);
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
      value={{ bookings, reviews, conversations, messages, createBooking, cancelBooking, sendMessage, markConversationRead }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

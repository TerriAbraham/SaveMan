import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError, errorMessage } from '@/api/auth-api';
import { dataApi } from '@/api/data-api';
import { useAuth } from '@/context/auth-context';
import { reviews as seedReviews } from '@/data/activity';
import { categories as seedCategories } from '@/data/categories';
import type { Booking, Category, Conversation, Message, Review } from '@/data/types';
import { useSavedState } from '@/hooks/use-saved-state';

/** What a client chooses on the booking screen. Everything else comes from the server. */
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

/** How often signed-in data is reloaded while the app is open, so new bookings and messages show up. */
const REFRESH_MS = 30_000;

// Actions resolve to an error message for the screen to show, or null on success.
// The server checks the caller's role and ownership for every one of them.
interface DataContextValue {
  bookings: Booking[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  categories: Category[];
  /** True while data is being reloaded from the server. */
  refreshing: boolean;
  /** Set when the last reload failed (usually offline); the saved copy is shown meanwhile. */
  offline: boolean;
  refresh: () => Promise<void>;
  createBooking: (request: BookingRequest) => Promise<{ booking: Booking; error?: never } | { booking?: never; error: string }>;
  /** Client cancels their own upcoming booking. */
  cancelBooking: (bookingId: string) => Promise<string | null>;
  /** Consultant accepts, declines or completes one of their bookings. */
  respondToBooking: (bookingId: string, response: BookingResponse) => Promise<string | null>;
  /** Client reviews their own completed booking, once. */
  addReview: (input: NewReview) => Promise<string | null>;
  /** Admin: hide a review and take it out of the rating. */
  removeReview: (reviewId: string) => Promise<string | null>;
  /** Admin: undo a removal. */
  restoreReview: (reviewId: string) => Promise<string | null>;
  /** Message between the signed-in user and `otherId` (client <-> consultant only). */
  sendMessage: (otherId: string, text: string) => Promise<string | null>;
  markConversationRead: (conversationId: string) => void;
  /** Admin category management. */
  saveCategory: (draft: CategoryDraft, editingId: string | null) => Promise<string | null>;
  deleteCategory: (categoryId: string) => Promise<string | null>;
}

const DataContext = createContext<DataContextValue | null>(null);

const replaceById = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

// Data comes from the SaveMan API and is saved on the device (SQLite), so the last copy can be
// browsed offline. Changes need the server. It sits above the auth screens: the home page shows
// public data (categories, consultants, reviews) before anyone logs in.
export function DataProvider({ children }: { children: ReactNode }) {
  const { user, token, refreshUsers, refreshUser, signOut } = useAuth();
  // Public data starts from the bundled dummy data, so the home page works offline on first launch.
  // Private data starts empty and only ever holds the signed-in user's own records.
  const [bookings, setBookings] = useSavedState<Booking[]>('bookings', []);
  const [reviews, setReviews] = useSavedState<Review[]>('reviews', seedReviews);
  const [conversations, setConversations] = useSavedState<Conversation[]>('conversations', []);
  const [messages, setMessages] = useSavedState<Message[]>('messages', []);
  const [categories, setCategories] = useSavedState<Category[]>('categories', seedCategories);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [cats, revs] = await Promise.all([dataApi.categories.list(), dataApi.reviews.list(token), refreshUsers()]);
      setCategories(cats);
      setReviews(revs);
      if (token) {
        const [b, c, m] = await Promise.all([dataApi.bookings.list(token), dataApi.conversations.list(token), dataApi.messages.list(token)]);
        setBookings(b);
        setConversations(c);
        setMessages(m);
      }
      setOffline(false);
    } catch (err) {
      // Expired or suspended: back to the login screen. Otherwise keep showing the saved copy.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403) && token) signOut();
      else setOffline(true);
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshUsers, signOut, setCategories, setReviews, setBookings, setConversations, setMessages]);

  // Logging out clears the previous user's private records from this device.
  const previousToken = useRef(token);
  useEffect(() => {
    if (previousToken.current && !token) {
      setBookings([]);
      setConversations([]);
      setMessages([]);
    }
    previousToken.current = token;
  }, [token, setBookings, setConversations, setMessages]);

  // Reload on start, on login/logout, when the app comes back to the foreground, and every 30 s while signed in.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    refreshRef.current();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refreshRef.current());
    const timer = token ? setInterval(() => AppState.currentState === 'active' && refreshRef.current(), REFRESH_MS) : undefined;
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [token]);

  /** Runs an API call with the session token. Resolves to an error message, or null. */
  async function run(action: (token: string) => Promise<void>) {
    if (!token) return 'Please log in again.';
    try {
      await action(token);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  async function createBooking(request: BookingRequest) {
    if (!token) return { error: 'Please log in again.' };
    try {
      const booking = await dataApi.bookings.create(token, request);
      setBookings((prev) => [...prev, booking]);
      return { booking };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }

  const setBookingStatus = (bookingId: string, status: Booking['status']) =>
    run(async (t) => {
      const updated = await dataApi.bookings.setStatus(t, bookingId, status);
      setBookings((prev) => replaceById(prev, updated));
    });

  const cancelBooking = (bookingId: string) => setBookingStatus(bookingId, 'cancelled');

  function respondToBooking(bookingId: string, response: BookingResponse) {
    const status = ({ accept: 'confirmed', decline: 'declined', complete: 'completed' } as const)[response];
    return setBookingStatus(bookingId, status);
  }

  const addReview = (input: NewReview) =>
    run(async (t) => {
      const review = await dataApi.reviews.create(t, input);
      setReviews((prev) => [review, ...prev]);
      await refreshUser(review.consultantId); // the server updated their rating
    });

  const moderateReview = (reviewId: string, removed: boolean) =>
    run(async (t) => {
      const review = await dataApi.reviews.setRemoved(t, reviewId, removed);
      setReviews((prev) => replaceById(prev, review));
      await refreshUser(review.consultantId);
    });

  const sendMessage = (otherId: string, text: string) => {
    if (text.trim() === '') return Promise.resolve('Write a message first.');
    return run(async (t) => {
      const { conversation, message } = await dataApi.messages.send(t, otherId, text.trim());
      setConversations((prev) => replaceById(prev, conversation));
      setMessages((prev) => [...prev, message]);
    });
  };

  // Shown as read straight away; the server is told in the background.
  const markConversationRead = useCallback(
    (conversationId: string) => {
      if (!user || !token) return;
      let changed = false;
      setMessages((prev) => {
        if (!prev.some((m) => m.conversationId === conversationId && m.senderId !== user.id && !m.read)) return prev;
        changed = true;
        return prev.map((m) => (m.conversationId === conversationId && m.senderId !== user.id ? { ...m, read: true } : m));
      });
      if (changed) dataApi.conversations.markRead(token, conversationId).catch(() => {});
    },
    [user, token, setMessages],
  );

  const saveCategory = (draft: CategoryDraft, editingId: string | null) =>
    run(async (t) => {
      const category = editingId ? await dataApi.categories.update(t, editingId, draft) : await dataApi.categories.create(t, draft);
      setCategories((prev) => replaceById(prev, category));
    });

  const deleteCategory = (categoryId: string) =>
    run(async (t) => {
      await dataApi.categories.remove(t, categoryId);
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    });

  return (
    <DataContext.Provider
      value={{
        bookings,
        reviews,
        conversations,
        messages,
        categories,
        refreshing,
        offline,
        refresh,
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

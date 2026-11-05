import type { Booking, Review } from '@/data/types';

import { fromISODate, toMinutes } from './dates';

// One place for the booking lifecycle, shared by screens (to show actions) and the store (to enforce them):
//   pending   -> confirmed (consultant accepts) | declined (consultant) | cancelled (client)
//   confirmed -> completed (consultant, once the session has started) | cancelled (client)

export function sessionStart(b: Booking) {
  const start = fromISODate(b.date);
  start.setMinutes(toMinutes(b.time));
  return start;
}

export function hasStarted(b: Booking, now: Date = new Date()) {
  return sessionStart(b).getTime() <= now.getTime();
}

/** A request can be accepted until its start time; after that it can only be declined. */
export function canAccept(b: Booking, now: Date = new Date()) {
  return b.status === 'pending' && !hasStarted(b, now);
}

export function canDecline(b: Booking) {
  return b.status === 'pending';
}

/** Sessions are marked completed after they've started, never in advance. */
export function canComplete(b: Booking, now: Date = new Date()) {
  return b.status === 'confirmed' && hasStarted(b, now);
}

/** Clients review a booking once, and only after it is completed. */
export function canReview(b: Booking, reviews: Review[], clientId: string) {
  return b.status === 'completed' && b.clientId === clientId && !reviews.some((r) => r.bookingId === b.id);
}

import type { Booking, Consultant } from '@/data/types';

import { fromISODate, fromMinutes, toISODate, toMinutes } from './dates';

export interface Slot {
  time: string; // "HH:mm"
  available: boolean;
}

/** Bookings that still hold a consultant's time. */
export const ACTIVE_STATUSES: Booking['status'][] = ['pending', 'confirmed'];

const SLOT_STEP_MINS = 60;

/**
 * Start times on a given day for a session of `durationMins`.
 * A slot is unavailable if it overlaps one of the consultant's pending or
 * confirmed bookings, or (for today) has already started.
 */
export function getSlots(
  consultant: Consultant,
  date: string,
  durationMins: number,
  bookings: Booking[],
  now: Date = new Date(),
): Slot[] {
  const weekday = fromISODate(date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const windows = consultant.availability[weekday] ?? [];

  const taken = bookings
    .filter((b) => b.consultantId === consultant.id && b.date === date && ACTIVE_STATUSES.includes(b.status))
    .map((b) => ({ start: toMinutes(b.time), end: toMinutes(b.time) + b.durationMins }));

  const isToday = date === toISODate(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const slots: Slot[] = [];
  for (const w of windows) {
    const windowEnd = toMinutes(w.end);
    for (let start = toMinutes(w.start); start + durationMins <= windowEnd; start += SLOT_STEP_MINS) {
      const end = start + durationMins;
      const clashes = taken.some((t) => start < t.end && t.start < end);
      const past = isToday && start <= nowMins;
      slots.push({ time: fromMinutes(start), available: !clashes && !past });
    }
  }
  return slots;
}

/** True if the consultant works at all on that date (used to grey out days). */
export function worksOn(consultant: Consultant, date: string) {
  const weekday = fromISODate(date).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return (consultant.availability[weekday]?.length ?? 0) > 0;
}

/** Pending/confirmed bookings from today on are "upcoming"; everything else is history. */
export function isUpcoming(booking: Booking, today: string = toISODate(new Date())) {
  return ACTIVE_STATUSES.includes(booking.status) && booking.date >= today;
}

// Dates are handled as local "YYYY-MM-DD" strings and times as "HH:mm",
// which keeps dummy data readable and avoids timezone surprises.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local "YYYY-MM-DDTHH:mm:ss" (no timezone), matching the dummy data so timestamps sort as strings. */
export function toLocalDateTime(d: Date) {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Parse "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC). */
export function fromISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** "13:30" -> 810 */
export function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 810 -> "13:30" */
export function fromMinutes(mins: number) {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

/** "13:30" -> "1:30 pm" */
export function formatTime(time: string) {
  const mins = toMinutes(time);
  const h = Math.floor(mins / 60);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${pad(mins % 60)} ${suffix}`;
}

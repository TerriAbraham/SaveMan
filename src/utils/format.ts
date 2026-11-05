import { formatTime, fromISODate, toISODate } from './dates';

/** "Dr. Michael Kila" -> "MK" */
export function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** 250 -> "K250" (PNG Kina) */
export function formatKina(amount: number) {
  return `K${amount.toLocaleString('en-US')}`;
}

/** 90 -> "1 hr 30 min" */
export function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short label for a message timestamp: "8:40 am" today, "Yesterday", "Wed" this week, else "5 Nov". */
export function formatMessageTime(sentAt: string, now: Date = new Date()) {
  const date = sentAt.slice(0, 10);
  const days = daysBetween(date, toISODate(now));
  if (days === 0) return formatTime(sentAt.slice(11, 16));
  if (days === 1) return 'Yesterday';
  if (days < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][fromISODate(date).getDay()];
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Day heading inside a chat: "Today", "Yesterday" or "5 Nov 2026". */
export function formatDayHeading(date: string, now: Date = new Date()) {
  const days = daysBetween(date, toISODate(now));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatDate(date);
}

function daysBetween(fromDate: string, toDate: string) {
  return Math.round((fromISODate(toDate).getTime() - fromISODate(fromDate).getTime()) / 86_400_000);
}

/** "2026-10-21" -> "21 Oct 2026" */
export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

import { Text, View } from 'react-native';

import type { BookingStatus } from '@/data/types';

export const bookingStatusMeta: Record<BookingStatus, { label: string; pill: string; text: string; explain: string }> = {
  pending: {
    label: 'Awaiting confirmation',
    pill: 'bg-gold-tint',
    text: 'text-ink-soft',
    explain: 'The consultant will accept or decline your request soon.',
  },
  confirmed: {
    label: 'Confirmed',
    pill: 'bg-forest-tint',
    text: 'text-forest',
    explain: 'Your session is booked. See you there!',
  },
  completed: { label: 'Completed', pill: 'bg-sand', text: 'text-fg-muted', explain: 'This session has finished.' },
  cancelled: { label: 'Cancelled', pill: 'bg-red-tint', text: 'text-red-dark', explain: 'This booking was cancelled.' },
  declined: {
    label: 'Declined',
    pill: 'bg-red-tint',
    text: 'text-red-dark',
    explain: 'The consultant could not take this booking. Try another time.',
  },
};

/**
 * `started` = the session's start time has passed. A request nobody answered in time
 * reads "Expired", and a confirmed session that happened reads "Awaiting completion".
 */
export function BookingStatusPill({ status, started }: { status: BookingStatus; started?: boolean }) {
  const base = bookingStatusMeta[status];
  const meta =
    started && status === 'pending'
      ? { ...base, label: 'Expired', pill: 'bg-red-tint', text: 'text-red-dark' }
      : started && status === 'confirmed'
        ? { ...base, label: 'Awaiting completion', pill: 'bg-gold-tint', text: 'text-ink-soft' }
        : base;
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${meta.pill}`}>
      <Text className={`text-caption font-semibold ${meta.text}`}>{meta.label}</Text>
    </View>
  );
}

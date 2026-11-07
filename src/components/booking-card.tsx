import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BookingStatusPill } from '@/components/booking-status';
import { Icon, type IconName } from '@/components/icon';
import { colors } from '@/constants/theme';
import type { Booking } from '@/data/types';
import { hasStarted } from '@/utils/booking-rules';
import { formatTime } from '@/utils/dates';
import { formatDate, formatKina } from '@/utils/format';

export const modeMeta: Record<Booking['mode'], { label: string; icon: IconName }> = {
  'in-person': { label: 'In person', icon: 'pin' },
  video: { label: 'Video call', icon: 'video' },
  phone: { label: 'Phone call', icon: 'phone' },
};

export function BookingCard({
  booking,
  personName,
  personAvatar,
  onPress,
  footer,
}: {
  booking: Booking;
  personName: string;
  personAvatar?: string;
  onPress: () => void;
  /** Extra content under the status, e.g. action buttons. */
  footer?: ReactNode;
}) {
  const mode = modeMeta[booking.mode];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.serviceName} with ${personName}, ${formatDate(booking.date)}`}
      className="gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4 active:opacity-85">
      <View className="flex-row items-center gap-3">
        <Avatar name={personName} uri={personAvatar} size="sm" />
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-fg" numberOfLines={1}>
            {booking.serviceName}
          </Text>
          <Text className="text-body text-fg-muted" numberOfLines={1}>
            {personName}
          </Text>
        </View>
        <Text className="text-label text-fg">{formatKina(booking.price)}</Text>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <Detail icon="calendar" text={formatDate(booking.date)} />
        <Detail icon="clock" text={formatTime(booking.time)} />
        <Detail icon={mode.icon} text={mode.label} />
      </View>

      <BookingStatusPill status={booking.status} started={hasStarted(booking)} />
      {footer}
    </Pressable>
  );
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text className="text-label font-normal text-fg-muted">{text}</Text>
    </View>
  );
}

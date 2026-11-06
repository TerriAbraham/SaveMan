import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { modeMeta } from '@/components/booking-card';
import { BookingStatusPill } from '@/components/booking-status';
import { Icon, type IconName } from '@/components/icon';
import { Stars } from '@/components/rating';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { useBookingActions } from '@/hooks/use-booking-actions';
import { canAccept, canComplete, canDecline, hasStarted } from '@/utils/booking-rules';
import { formatTime } from '@/utils/dates';
import { formatDate, formatDuration, formatKina } from '@/utils/format';
import { callPhone } from '@/utils/phone';

const consultantExplain = {
  pending: 'Accept to confirm this session, or decline if you can’t take it.',
  confirmed: 'This session is confirmed.',
  completed: 'This session is complete.',
  cancelled: 'The client cancelled this booking.',
  declined: 'You declined this request.',
} as const;

export default function ConsultantBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, users } = useAuth();
  const { bookings, reviews } = useData();
  const actions = useBookingActions();

  const booking = bookings.find((b) => b.id === id && b.consultantId === user?.id);
  const client = users.find((u) => u.id === booking?.clientId);

  if (!booking || !client || client.role !== 'client') {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Booking" fallbackHref="/consultant" />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-body text-fg-muted">This booking could not be found.</Text>
        </View>
      </View>
    );
  }

  const mode = modeMeta[booking.mode];
  const review = reviews.find((r) => r.bookingId === booking.id && !r.removedAt);
  const confirmedNotStarted = booking.status === 'confirmed' && !hasStarted(booking);

  return (
    <View className="flex-1 bg-sand">
      <ScreenHeader title="Booking details" subtitle={booking.serviceName} fallbackHref="/consultant" />
      <ScrollView contentContainerClassName="gap-4 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-3 rounded-card border border-line bg-surface p-4">
          <BookingStatusPill status={booking.status} started={hasStarted(booking)} />
          <Text className="text-body text-fg-muted">
            {confirmedNotStarted ? 'Confirmed. You can mark it completed once the session starts.' : consultantExplain[booking.status]}
          </Text>
          <View className="flex-row items-center gap-3 border-t border-line pt-3">
            <Avatar name={client.name} />
            <View className="flex-1">
              <Text className="text-heading text-fg">{client.name}</Text>
              <Text className="text-body text-fg-muted">
                Client · {client.city} · {client.phone}
              </Text>
            </View>
          </View>
        </View>

        <View className="gap-3 rounded-card border border-line bg-surface p-4">
          <Text className="text-heading text-fg">Session</Text>
          <Row icon="briefcase" label="Service" value={booking.serviceName} />
          <Row icon="calendar" label="Date" value={formatDate(booking.date)} />
          <Row icon="clock" label="Time" value={`${formatTime(booking.time)} · ${formatDuration(booking.durationMins)}`} />
          <Row icon={mode.icon} label="Type" value={mode.label} />
          <Row icon="note" label="Client's note" value={booking.note || 'No note'} />
          <View className="flex-row items-center justify-between border-t border-line pt-3">
            <Text className="text-body text-fg-muted">Fee</Text>
            <Text className="text-title text-fg">{formatKina(booking.price)}</Text>
          </View>
        </View>

        {review && (
          <View className="gap-2 rounded-card border border-line bg-surface p-4">
            <Text className="text-heading text-fg">Client review</Text>
            <Stars rating={review.rating} size={16} />
            {review.comment !== '' && <Text className="text-body text-fg">{review.comment}</Text>}
          </View>
        )}

        {canAccept(booking) && <Button title="Accept request" onPress={() => actions.accept(booking)} />}
        {canDecline(booking) && (
          <Button title="Decline request" variant="outline" onPress={() => actions.decline(booking, client.name)} />
        )}
        {canComplete(booking) && <Button title="Mark as completed" onPress={() => actions.complete(booking)} />}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title={`Message ${client.name.split(' ')[0]}`}
              variant="secondary"
              onPress={() => router.push({ pathname: '/consultant/chat/[id]', params: { id: client.id } })}
            />
          </View>
          <View className="flex-1">
            <Button title="Call" variant="outline" onPress={() => callPhone(client.name, client.phone)} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <Icon name={icon} size={18} color={colors.textMuted} />
      <View className="flex-1">
        <Text className="text-caption text-fg-muted">{label}</Text>
        <Text className="text-body text-fg">{value}</Text>
      </View>
    </View>
  );
}

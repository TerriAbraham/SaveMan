import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { modeMeta } from '@/components/booking-card';
import { BookingStatusPill, bookingStatusMeta } from '@/components/booking-status';
import { Icon, type IconName } from '@/components/icon';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { Stars } from '@/components/rating';
import { isUpcoming } from '@/utils/availability';
import { canReview, hasStarted } from '@/utils/booking-rules';
import { formatTime } from '@/utils/dates';
import { formatDate, formatDuration, formatKina } from '@/utils/format';

export default function BookingDetailScreen() {
  const { id, justBooked } = useLocalSearchParams<{ id: string; justBooked?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, users } = useAuth();
  const { bookings, reviews, cancelBooking } = useData();

  const booking = bookings.find((b) => b.id === id && b.clientId === user?.id);
  const consultant = users.find((u) => u.id === booking?.consultantId);

  if (!booking || !consultant || consultant.role !== 'consultant') {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Booking" fallbackHref="/client/bookings" />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-body text-fg-muted">This booking could not be found.</Text>
        </View>
      </View>
    );
  }

  const started = hasStarted(booking);
  const explain =
    started && booking.status === 'pending'
      ? 'The consultant didn’t respond before the session time. Please book another time.'
      : started && booking.status === 'confirmed'
        ? 'This session has taken place. The consultant will mark it completed, then you can leave a review.'
        : bookingStatusMeta[booking.status].explain;
  // Can't cancel a session that has already started.
  const canCancel = isUpcoming(booking) && !started;
  const mode = modeMeta[booking.mode];
  const myReview = reviews.find((r) => r.bookingId === booking.id);
  const reviewable = user !== null && canReview(booking, reviews, user.id);

  function confirmCancel() {
    Alert.alert('Cancel this booking?', 'The consultant will be told the session is cancelled.', [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => {
          const error = cancelBooking(booking!.id);
          if (error) Alert.alert('Could not cancel', error);
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-sand">
      <ScreenHeader title="Booking details" subtitle={booking.serviceName} fallbackHref="/client/bookings" />
      <ScrollView contentContainerClassName="gap-4 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {justBooked === '1' && booking.status === 'pending' && (
          <View className="flex-row items-start gap-3 rounded-card bg-forest-tint p-4">
            <Icon name="check" size={24} color={colors.forest} />
            <View className="flex-1 gap-0.5">
              <Text className="text-heading text-forest">Booking request sent</Text>
              <Text className="text-body text-fg">
                {consultant.name} will confirm your session. You can find it any time under Bookings.
              </Text>
            </View>
          </View>
        )}

        <View className="gap-3 rounded-card border border-line bg-surface p-4">
          <BookingStatusPill status={booking.status} started={hasStarted(booking)} />
          <Text className="text-body text-fg-muted">{explain}</Text>

          <Pressable
            onPress={() => router.push({ pathname: '/client/consultant/[id]', params: { id: consultant.id } })}
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-t border-line pt-3 active:opacity-70">
            <Avatar name={consultant.name} />
            <View className="flex-1">
              <Text className="text-heading text-fg">{consultant.name}</Text>
              <Text className="text-body text-fg-muted">{consultant.title}</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View className="gap-3 rounded-card border border-line bg-surface p-4">
          <Text className="text-heading text-fg">Session</Text>
          <Row icon="briefcase" label="Service" value={booking.serviceName} />
          <Row icon="calendar" label="Date" value={formatDate(booking.date)} />
          <Row icon="clock" label="Time" value={`${formatTime(booking.time)} · ${formatDuration(booking.durationMins)}`} />
          <Row
            icon={mode.icon}
            label="Type"
            value={booking.mode === 'in-person' ? `${mode.label}, ${consultant.location.city}` : mode.label}
          />
          {booking.note !== '' && <Row icon="note" label="Your note" value={booking.note} />}
          <View className="flex-row items-center justify-between border-t border-line pt-3">
            <Text className="text-body text-fg-muted">Price</Text>
            <Text className="text-title text-fg">{formatKina(booking.price)}</Text>
          </View>
        </View>

        {myReview ? (
          <View className="gap-2 rounded-card border border-line bg-surface p-4">
            <Text className="text-heading text-fg">Your review</Text>
            <Stars rating={myReview.rating} size={16} />
            {myReview.comment !== '' && <Text className="text-body text-fg">{myReview.comment}</Text>}
            {myReview.removedAt && (
              <Text className="text-caption text-red-dark">
                Removed by SaveMan moderators for breaking the review guidelines. It isn’t shown on the profile.
              </Text>
            )}
          </View>
        ) : (
          reviewable && (
            <View className="gap-3 rounded-card bg-gold-tint p-4">
              <Text className="text-body text-fg">How did it go? Your review helps other clients choose.</Text>
              <Button
                title="Leave a review"
                onPress={() => router.push({ pathname: '/client/review/[id]', params: { id: booking.id } })}
              />
            </View>
          )
        )}

        <Button
          title={`Message ${consultant.name.replace(/^Dr\.?\s+/, '').split(' ')[0]}`}
          variant="secondary"
          onPress={() => router.push({ pathname: '/client/chat/[id]', params: { id: consultant.id } })}
        />
        {canCancel && <Button title="Cancel booking" variant="ghost" onPress={confirmCancel} />}
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

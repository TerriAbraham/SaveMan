import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { canReview } from '@/utils/booking-rules';
import { formatDate } from '@/utils/format';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Review a completed booking; `id` is the booking id. */
export default function LeaveReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, users } = useAuth();
  const { bookings, reviews, addReview } = useData();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const booking = bookings.find((b) => b.id === id);
  const consultant = users.find((u) => u.id === booking?.consultantId);

  if (!booking || !consultant || !user || !canReview(booking, reviews, user.id)) {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Leave a review" fallbackHref="/client/bookings" />
        <View className="flex-1 items-center justify-center gap-2 p-6">
          <Icon name="star" size={28} color={colors.textMuted} />
          <Text className="text-center text-body text-fg-muted">
            You can review a session once, after the consultant marks it completed.
          </Text>
        </View>
      </View>
    );
  }

  function submit() {
    if (!booking || !user) return;
    if (rating === 0) {
      setError('Tap the stars to choose a rating.');
      return;
    }
    const result = addReview({ bookingId: booking.id, clientId: user.id, rating, comment });
    if (result) {
      setError(result);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Leave a review" subtitle={booking.serviceName} fallbackHref="/client/bookings" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="items-center gap-2 rounded-card border border-line bg-surface p-6">
          <Avatar name={consultant.name} size="lg" />
          <Text className="mt-1 text-heading text-fg">{consultant.name}</Text>
          <Text className="text-body text-fg-muted">
            {booking.serviceName} · {formatDate(booking.date)}
          </Text>

          <Text className="mt-3 text-label text-fg">How was your session?</Text>
          <View className="flex-row gap-1" accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  setRating(n);
                  setError(null);
                }}
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityState={{ checked: rating === n }}
                accessibilityLabel={`${n} star${n > 1 ? 's' : ''}, ${LABELS[n]}`}
                className="p-1">
                <Icon name="star" size={36} color={n <= rating ? colors.gold : colors.border} />
              </Pressable>
            ))}
          </View>
          <Text className="h-5 text-label text-fg-muted">{LABELS[rating]}</Text>
        </View>

        <View className="gap-2 rounded-card border border-line bg-surface p-4">
          <Text className="text-label text-fg">Tell other clients about it (optional)</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="What went well? What could be better?"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
            className="min-h-[110px] rounded-xl border-[1.5px] border-line bg-sand p-3 text-[16px] text-fg"
          />
          <Text className="self-end text-caption text-fg-muted">{comment.length}/500</Text>
        </View>

        {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}

        <Button title="Post review" onPress={submit} />
        <Text className="text-center text-caption text-fg-muted">
          Reviews show your name and appear on {consultant.name}&apos;s profile.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

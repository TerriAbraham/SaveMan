import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { BookingCard } from '@/components/booking-card';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { isUpcoming } from '@/utils/availability';
import { canReview } from '@/utils/booking-rules';

type Tab = 'upcoming' | 'past';

export default function MyBookingsScreen() {
  const router = useRouter();
  const { user, users } = useAuth();
  const { bookings, reviews } = useData();
  const [tab, setTab] = useState<Tab>('upcoming');

  const mine = bookings.filter((b) => b.clientId === user?.id);
  const upcoming = mine
    .filter((b) => isUpcoming(b))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const past = mine
    .filter((b) => !isUpcoming(b))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <View className="flex-1 bg-sand">
      <View className="border-b border-line bg-surface p-4">
        <View className="flex-row gap-1 rounded-xl bg-sand p-1" accessibilityRole="tablist">
          {(['upcoming', 'past'] as const).map((t) => {
            const selected = t === tab;
            const count = t === 'upcoming' ? upcoming.length : past.length;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className={`flex-1 items-center rounded-lg py-2.5 ${selected ? 'bg-ink' : ''}`}>
                <Text className={`text-[14px] font-semibold ${selected ? 'text-on-dark' : 'text-fg-muted'}`}>
                  {t === 'upcoming' ? 'Upcoming' : 'Past'} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerClassName="gap-3 p-4 pb-8"
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            personName={users.find((u) => u.id === item.consultantId)?.name ?? 'Consultant'}
            onPress={() => router.push({ pathname: '/client/booking/[id]', params: { id: item.id } })}
            footer={
              user && canReview(item, reviews, user.id) ? (
                <Text className="text-label text-red">★ Leave a review</Text>
              ) : undefined
            }
          />
        )}
        ListEmptyComponent={
          <View className="items-center gap-3 rounded-card border border-line bg-surface p-6">
            <Icon name="calendar" size={28} color={colors.textMuted} />
            <Text className="text-heading text-fg">
              {tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'}
            </Text>
            <Text className="text-center text-body text-fg-muted">
              {tab === 'upcoming'
                ? 'Find a verified consultant and book your first session.'
                : 'Sessions you have finished or cancelled will appear here.'}
            </Text>
            {tab === 'upcoming' && (
              <View className="self-stretch">
                <Button title="Find a consultant" onPress={() => router.navigate('/client')} />
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

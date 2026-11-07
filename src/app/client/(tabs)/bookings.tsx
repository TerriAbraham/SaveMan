import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { BookingCard } from '@/components/booking-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
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
        <SegmentedControl
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'upcoming', label: `Upcoming (${upcoming.length})` },
            { value: 'past', label: `Past (${past.length})` },
          ]}
        />
      </View>

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerClassName="gap-3 p-4 pb-8"
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            personName={users.find((u) => u.id === item.consultantId)?.name ?? 'Consultant'}
            personAvatar={users.find((u) => u.id === item.consultantId)?.avatarUri}
            onPress={() => router.push({ pathname: '/client/booking/[id]', params: { id: item.id } })}
            footer={
              user && canReview(item, reviews, user.id) ? (
                <Text className="text-label text-red">★ Leave a review</Text>
              ) : undefined
            }
          />
        )}
        ListEmptyComponent={
          tab === 'upcoming' ? (
            <EmptyState
              icon="calendar"
              title="No upcoming sessions"
              message="Find a verified consultant and book your first session."
              actionLabel="Find a consultant"
              onAction={() => router.navigate('/client')}
            />
          ) : (
            <EmptyState
              icon="calendar"
              title="No past sessions yet"
              message="Sessions you have finished or cancelled will appear here."
            />
          )
        }
      />
    </View>
  );
}

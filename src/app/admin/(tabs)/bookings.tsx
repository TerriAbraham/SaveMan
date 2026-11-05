import { useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, View } from 'react-native';

import { modeMeta } from '@/components/booking-card';
import { BookingStatusPill, bookingStatusMeta } from '@/components/booking-status';
import { Icon } from '@/components/icon';
import { Chip } from '@/components/ui/chip';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { BookingStatus } from '@/data/types';
import { formatTime } from '@/utils/dates';
import { formatDate, formatKina } from '@/utils/format';

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'declined'];

export default function AdminBookingsScreen() {
  const { users } = useAuth();
  const { bookings } = useData();
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [query, setQuery] = useState('');

  const name = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';
  const q = query.trim().toLowerCase();
  const list = bookings
    .filter((b) => !status || b.status === status)
    .map((b) => ({ ...b, clientName: name(b.clientId), consultantName: name(b.consultantId) }))
    .filter((b) => !q || `${b.clientName} ${b.consultantName} ${b.serviceName}`.toLowerCase().includes(q))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const total = list.reduce((sum, b) => sum + b.price, 0);

  return (
    <View className="flex-1 bg-sand">
      <View className="gap-3 border-b border-line bg-surface py-3">
        <View className="mx-4 min-h-[44px] flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-sand px-4">
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Client, consultant or service"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            accessibilityLabel="Search bookings"
            className="flex-1 py-2 text-[16px] text-fg"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          <Chip label="All" selected={status === null} onPress={() => setStatus(null)} />
          {STATUSES.map((s) => (
            <Chip key={s} label={bookingStatusMeta[s].label} selected={status === s} onPress={() => setStatus(status === s ? null : s)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-2 p-4 pb-8"
        ListHeaderComponent={
          <Text className="text-label text-fg-muted">
            {list.length} bookings · {formatKina(total)} total value
          </Text>
        }
        renderItem={({ item }) => (
          <View className="gap-2 rounded-card border border-line bg-surface p-3.5">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-[15px] font-bold text-fg">{item.serviceName}</Text>
              <Text className="text-label text-fg">{formatKina(item.price)}</Text>
            </View>
            <Text className="text-body text-fg">
              {item.clientName} <Text className="text-fg-muted">→</Text> {item.consultantName}
            </Text>
            <Text className="text-caption text-fg-muted">
              {formatDate(item.date)} · {formatTime(item.time)} · {modeMeta[item.mode].label}
            </Text>
            <BookingStatusPill status={item.status} />
          </View>
        )}
        ListEmptyComponent={<Text className="p-6 text-center text-body text-fg-muted">No bookings match.</Text>}
      />
    </View>
  );
}

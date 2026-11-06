import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { formatDuration, formatKina } from '@/utils/format';

export default function MyServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  if (user?.role !== 'consultant') return null;

  const openEditor = (id: string) => router.push({ pathname: '/consultant/service/[id]', params: { id } });

  return (
    <FlatList
      data={user.services}
      keyExtractor={(s) => s.id}
      contentContainerClassName="gap-3 p-4 pb-8"
      ListHeaderComponent={
        <View className="gap-3">
          <Text className="text-body text-fg-muted">
            Clients choose one of these when they book you. Changes show on your profile straight away; existing bookings
            keep the details they were booked with.
          </Text>
          <Button title="Add a service" onPress={() => openEditor('new')} />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openEditor(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          className="gap-1 rounded-card border border-line/70 bg-surface shadow-card p-4 active:opacity-85">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-[15px] font-bold text-fg">{item.name}</Text>
            <Text className="text-[15px] font-bold text-red">{formatKina(item.price)}</Text>
          </View>
          {item.description !== '' && <Text className="text-body text-fg-muted">{item.description}</Text>}
          <View className="mt-1 flex-row items-center gap-1">
            <Icon name="clock" size={13} color={colors.textMuted} />
            <Text className="flex-1 text-caption text-fg-muted">{formatDuration(item.durationMins)}</Text>
            <Text className="text-label text-red">Edit</Text>
            <Icon name="chevronRight" size={14} color={colors.red} />
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <EmptyState icon="briefcase" title="No services yet" message="Add at least one service so clients can book you." />
      }
    />
  );
}

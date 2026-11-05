import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { UserBadges } from '@/components/user-badges';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import type { User } from '@/data/types';

type Filter = 'all' | 'client' | 'consultant' | 'suspended';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'client', label: 'Clients' },
  { key: 'consultant', label: 'Consultants' },
  { key: 'suspended', label: 'Suspended' },
];

export default function AdminUsersScreen() {
  const router = useRouter();
  const { users } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const q = query.trim().toLowerCase();
  const list = users
    .filter((u): u is Exclude<User, { role: 'admin' }> => u.role !== 'admin')
    .filter((u) => (filter === 'all' ? true : filter === 'suspended' ? u.status === 'suspended' : u.role === filter))
    .filter((u) => !q || `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View className="flex-1 bg-sand">
      <View className="gap-3 border-b border-line bg-surface py-3">
        <View className="px-4">
          <SearchField value={query} onChangeText={setQuery} placeholder="Name, email or phone" label="Search users" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-2 p-4 pb-8"
        ListHeaderComponent={<Text className="text-label text-fg-muted">{list.length} users</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            className={`flex-row items-center gap-3 rounded-card border bg-surface p-3 active:opacity-85 ${item.status === 'suspended' ? 'border-red' : 'border-line'}`}>
            <Avatar name={item.name} size="sm" />
            <View className="flex-1 gap-1">
              <Text className="text-[15px] font-bold text-fg" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-caption text-fg-muted" numberOfLines={1}>
                {item.email}
              </Text>
              <UserBadges user={item} />
            </View>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState icon="people" title="No users found" message="Try another name, or a different filter." />
        }
      />
    </View>
  );
}

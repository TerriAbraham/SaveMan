import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Stars } from '@/components/rating';
import { SmallButton } from '@/components/ui/small-button';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { useAdminActions } from '@/hooks/use-admin-actions';
import { formatDate } from '@/utils/format';

type Tab = 'visible' | 'removed';

export default function AdminReviewsScreen() {
  const { users } = useAuth();
  const { reviews } = useData();
  const actions = useAdminActions();
  const [tab, setTab] = useState<Tab>('visible');

  const name = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';
  const visible = reviews.filter((r) => !r.removedAt);
  const removed = reviews.filter((r) => r.removedAt);
  // Lowest ratings first in the visible list: they are the most likely to need a look.
  const list = (tab === 'visible' ? visible : removed).slice().sort((a, b) =>
    tab === 'visible' ? a.rating - b.rating || b.createdAt.localeCompare(a.createdAt) : (b.removedAt ?? '').localeCompare(a.removedAt ?? ''),
  );

  return (
    <View className="flex-1 bg-sand">
      <View className="border-b border-line bg-surface p-4">
        <View className="flex-row gap-1 rounded-xl bg-sand p-1" accessibilityRole="tablist">
          {(['visible', 'removed'] as const).map((t) => {
            const selected = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className={`flex-1 items-center rounded-lg py-2.5 ${selected ? 'bg-ink' : ''}`}>
                <Text className={`text-[14px] font-semibold ${selected ? 'text-on-dark' : 'text-fg-muted'}`}>
                  {t === 'visible' ? `Visible (${visible.length})` : `Removed (${removed.length})`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerClassName="gap-2 p-4 pb-8"
        ListHeaderComponent={
          <Text className="text-caption text-fg-muted">
            {tab === 'visible'
              ? 'Lowest ratings first. Remove reviews that are abusive, share personal details, or are not about the session.'
              : 'Removed reviews are hidden from profiles and do not count towards ratings.'}
          </Text>
        }
        renderItem={({ item }) => (
          <View className={`gap-2 rounded-card border bg-surface p-3.5 ${item.removedAt ? 'border-line opacity-70' : 'border-line'}`}>
            <View className="flex-row items-center justify-between">
              <Stars rating={item.rating} />
              <Text className="text-caption text-fg-muted">{formatDate(item.createdAt)}</Text>
            </View>
            <Text className="text-body text-fg">{item.comment || <Text className="italic text-fg-muted">No comment</Text>}</Text>
            <Text className="text-caption text-fg-muted">
              By {name(item.clientId)} · about {name(item.consultantId)}
              {item.removedAt ? ` · removed ${formatDate(item.removedAt)}` : ''}
            </Text>
            <View className="flex-row justify-end">
              {item.removedAt ? (
                <SmallButton label="Restore" variant="outline" onPress={() => actions.restoreReview(item)} />
              ) : (
                <SmallButton label="Remove review" variant="danger" onPress={() => actions.removeReview(item)} />
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text className="p-6 text-center text-body text-fg-muted">
            {tab === 'visible' ? 'No reviews yet.' : 'No removed reviews.'}
          </Text>
        }
      />
    </View>
  );
}

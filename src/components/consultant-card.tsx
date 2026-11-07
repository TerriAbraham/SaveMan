import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { RatingSummary } from '@/components/rating';
import { VerifiedBadge } from '@/components/verified-badge';
import { colors } from '@/constants/theme';
import type { Consultant } from '@/data/types';
import { formatKina } from '@/utils/format';

export function ConsultantCard({
  consultant,
  categoryName,
  onPress,
}: {
  consultant: Consultant;
  categoryName: string;
  onPress: () => void;
}) {
  const c = consultant;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${c.title}, ${c.location.city}`}
      className="gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4 active:opacity-85">
      <View className="flex-row gap-3">
        <Avatar name={c.name} uri={c.avatarUri} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Text className="shrink text-heading text-fg" numberOfLines={1}>
              {c.name}
            </Text>
            <VerifiedBadge compact />
          </View>
          <Text className="text-body text-fg-muted" numberOfLines={1}>
            {c.title}
          </Text>
          <View className="mt-1 flex-row items-center gap-3">
            <RatingSummary rating={c.rating} count={c.reviewCount} />
            <View className="flex-row items-center gap-0.5">
              <Icon name="pin" size={14} color={colors.textMuted} />
              <Text className="text-label font-normal text-fg-muted">{c.location.city}</Text>
            </View>
          </View>
        </View>
        <Icon name="chevronRight" size={18} color={colors.textMuted} />
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        <View className="rounded-full bg-red-tint px-2.5 py-1">
          <Text className="text-caption font-semibold text-red-dark">{categoryName}</Text>
        </View>
        {c.expertise.slice(0, 2).map((e) => (
          <View key={e} className="rounded-full bg-sand px-2.5 py-1">
            <Text className="text-caption text-fg-muted">{e}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between border-t border-line pt-3">
        <Text className="text-caption text-fg-muted">
          {c.services.length} {c.services.length === 1 ? 'service' : 'services'} · {c.yearsExperience} yrs experience
        </Text>
        <Text className="text-label text-fg">
          from <Text className="text-heading text-red">{formatKina(Math.min(...c.services.map((s) => s.price), c.hourlyRate))}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

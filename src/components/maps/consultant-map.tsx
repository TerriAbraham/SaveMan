import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import type { Consultant } from '@/data/types';

export interface ConsultantMapProps {
  consultants: Consultant[];
  onSelect: (consultantId: string) => void;
}

/**
 * Web fallback: react-native-maps has no web support, so list the locations instead.
 * Android and iOS use consultant-map.native.tsx.
 */
export function ConsultantMap({ consultants, onSelect }: ConsultantMapProps) {
  return (
    <ScrollView contentContainerClassName="gap-2 p-4 pt-[120px]">
      <Text className="text-body text-fg-muted">The map is available in the mobile app.</Text>
      {consultants.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onSelect(c.id)}
          className="flex-row items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <Icon name="pin" size={18} color={colors.red} />
          <View className="flex-1">
            <Text className="text-label text-fg">{c.name}</Text>
            <Text className="text-caption text-fg-muted">
              {c.location.address ? `${c.location.address}, ` : ''}
              {c.location.city}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

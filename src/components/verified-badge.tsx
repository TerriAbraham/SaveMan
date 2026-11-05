import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

export function VerifiedBadge({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <View accessibilityLabel="Verified consultant">
        <Icon name="verified" size={16} color={colors.forest} />
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-forest-tint px-2.5 py-1">
      <Icon name="verified" size={14} color={colors.forest} />
      <Text className="text-label text-forest">Verified by SaveMan</Text>
    </View>
  );
}

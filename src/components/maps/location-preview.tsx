import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import type { Location } from '@/data/types';

export interface LocationPreviewProps {
  location: Location;
  name?: string;
}

/** Web fallback for the profile map (react-native-maps has no web support). */
export function LocationPreview({ location }: LocationPreviewProps) {
  return (
    <View className="h-[120px] items-center justify-center gap-1 rounded-xl bg-sand">
      <Icon name="map" size={24} color={colors.textMuted} />
      <Text className="text-caption text-fg-muted">
        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
      </Text>
    </View>
  );
}

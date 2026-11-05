import { Text, View } from 'react-native';

import type { Coordinate } from '@/utils/geo';

export interface LocationPickerProps {
  value: Coordinate;
  onChange: (point: Coordinate) => void;
  /** Called with true while the user is touching the map, so a parent ScrollView can pause. */
  onInteractionChange?: (active: boolean) => void;
}

/** Web fallback: no map on web, so only the town chips and current-location button can move the pin. */
export function LocationPicker({ value }: LocationPickerProps) {
  return (
    <View className="items-center gap-1 rounded-xl border-[1.5px] border-line bg-sand p-4">
      <Text className="text-label text-fg">Pin: {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}</Text>
      <Text className="text-caption text-fg-muted">Open the mobile app to drag the pin on a map.</Text>
    </View>
  );
}

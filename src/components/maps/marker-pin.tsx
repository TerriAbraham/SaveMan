import { Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { initials } from '@/utils/format';

/** Custom map marker: initials in a brand-coloured bubble with a pointer. Anchor it at { x: 0.5, y: 1 }. */
export function MarkerPin({ name, highlighted }: { name?: string; highlighted?: boolean }) {
  return (
    <View className="items-center">
      <View
        className={`h-10 w-10 items-center justify-center rounded-full border-2 border-gold ${highlighted ? 'bg-red' : 'bg-ink'}`}>
        <Text className="text-[13px] font-extrabold text-on-dark">{name ? initials(name) : '★'}</Text>
      </View>
      {/* Pointer drawn with borders, so its geometry stays in style. */}
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 8,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: colors.gold,
        }}
      />
    </View>
  );
}

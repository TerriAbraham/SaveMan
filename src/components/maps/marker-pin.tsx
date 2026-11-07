import { Text, View } from 'react-native';

import { initials } from '@/utils/format';

/** Custom map marker: initials in a brand-coloured bubble with a pointer. Anchor it at { x: 0.5, y: 1 }. */
export function MarkerPin({ name, highlighted }: { name?: string; highlighted?: boolean }) {
  return (
    <View className="items-center">
      <View
        className={`h-10 w-10 items-center justify-center rounded-full border-2 border-gold ${highlighted ? 'bg-red' : 'bg-ink'}`}>
        <Text className="text-[13px] font-extrabold text-on-dark">{name ? initials(name) : '★'}</Text>
      </View>
      {/* Pointer: a triangle drawn with borders. */}
      <View className="-mt-px h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-gold" />
    </View>
  );
}

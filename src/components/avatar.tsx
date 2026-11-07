import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { initials } from '@/utils/format';

const sizes = {
  sm: { box: 'h-10 w-10 border-2', text: 'text-[14px]' },
  md: { box: 'h-14 w-14 border-2', text: 'text-[19px]' },
  lg: { box: 'h-[76px] w-[76px] border-[3px]', text: 'text-[26px]' },
  xl: { box: 'h-28 w-28 border-[3px]', text: 'text-[38px]' },
} as const;

/** Profile photo with a gold ring, or initials on ink when there's no photo. */
export function Avatar({ name, uri, size = 'md' }: { name: string; uri?: string; size?: keyof typeof sizes }) {
  const s = sizes[size];
  return (
    <View className={`items-center justify-center overflow-hidden rounded-full border-gold bg-ink ${s.box}`}>
      {uri ? (
        <Image source={{ uri }} className="h-full w-full" contentFit="cover" accessibilityLabel={`Photo of ${name}`} />
      ) : (
        <Text className={`font-extrabold text-on-dark ${s.text}`}>{initials(name)}</Text>
      )}
    </View>
  );
}

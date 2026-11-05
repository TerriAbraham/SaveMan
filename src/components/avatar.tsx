import { Text, View } from 'react-native';

import { initials } from '@/utils/format';

const sizes = {
  sm: { box: 'h-10 w-10 border-2', text: 'text-[14px]' },
  md: { box: 'h-14 w-14 border-2', text: 'text-[19px]' },
  lg: { box: 'h-[76px] w-[76px] border-[3px]', text: 'text-[26px]' },
} as const;

/** Initials on ink with a gold ring. Dummy data has no photos. */
export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof sizes }) {
  const s = sizes[size];
  return (
    <View className={`items-center justify-center rounded-full border-gold bg-ink ${s.box}`}>
      <Text className={`font-extrabold text-on-dark ${s.text}`}>{initials(name)}</Text>
    </View>
  );
}

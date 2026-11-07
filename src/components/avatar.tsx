import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { API_URL } from '@/api/auth-api';
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
  // Uploaded photos are stored as an address on the SaveMan server; a just-picked one is a local file.
  const source = uri?.startsWith('/api/') ? `${API_URL}${uri}` : uri;
  return (
    <View className={`items-center justify-center overflow-hidden rounded-full border-gold bg-ink ${s.box}`}>
      {source ? (
        <Image source={{ uri: source }} className="h-full w-full" contentFit="cover" accessibilityLabel={`Photo of ${name}`} />
      ) : (
        <Text className={`font-extrabold text-on-dark ${s.text}`}>{initials(name)}</Text>
      )}
    </View>
  );
}

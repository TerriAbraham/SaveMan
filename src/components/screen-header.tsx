import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

/** Dark header with a back button for screens pushed over the tabs. */
export function ScreenHeader({
  title,
  subtitle,
  leading,
  fallbackHref,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  fallbackHref: Href;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-row items-center gap-3 bg-ink px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-10 w-10 items-center justify-center rounded-full bg-ink-soft">
        <Icon name="back" size={20} color={colors.textOnDark} />
      </Pressable>
      {leading}
      <View className="flex-1">
        <Text className="text-heading text-on-dark" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-caption text-on-dark-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

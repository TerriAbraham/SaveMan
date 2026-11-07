import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark, HeroTexture, PatternBand } from '@/components/brand';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { useServerWaking } from '@/hooks/use-server-waking';

/** Shared frame for the login and sign-up screens. */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const waking = useServerWaking();

  return (
    // Expo apps are edge-to-edge, so Android needs a behavior too or inputs stay under the keyboard.
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <View className="gap-1 overflow-hidden px-6 pb-7 pt-safe-offset-2">
        <HeroTexture />
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10">
            <Icon name="back" size={20} color={colors.textOnDark} />
          </Pressable>
          <BrandMark size="sm" />
        </View>
        <Text className="text-display text-on-dark">{title}</Text>
        <Text className="text-body text-on-dark-muted">{subtitle}</Text>
      </View>
      <PatternBand size="md" />
      <ScrollView
        className="flex-1 bg-sand"
        contentContainerClassName="gap-4 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        {waking && (
          <View accessibilityLiveRegion="polite" className="flex-row items-center gap-3 rounded-card border border-gold/40 bg-gold-tint p-4">
            <ActivityIndicator color={colors.goldDark} />
            <Text className="flex-1 text-body text-fg">Waking up the SaveMan server. This can take up to a minute the first time.</Text>
          </View>
        )}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark, PatternBand } from '@/components/brand';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

/** Shared frame for the login and sign-up screens. */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Safe-area insets are dynamic, so they stay in style. */}
      <View className="gap-1 bg-ink px-6 pb-6" style={{ paddingTop: insets.top + 8 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-full bg-ink-soft">
            <Icon name="back" size={20} color={colors.textOnDark} />
          </Pressable>
          <BrandMark size={36} />
        </View>
        <Text className="text-display text-on-dark">{title}</Text>
        <Text className="text-body text-on-dark-muted">{subtitle}</Text>
      </View>
      <PatternBand height={10} count={40} />
      <ScrollView
        className="flex-1 bg-sand"
        contentContainerClassName="gap-4 p-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

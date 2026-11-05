import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

// Tabs sit at the bottom of the stack; detail screens like a consultant profile push over them.
export const unstable_settings = { anchor: '(tabs)' };

export default function ClientLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand } }} />;
}

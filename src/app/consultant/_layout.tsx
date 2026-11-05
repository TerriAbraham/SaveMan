import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

// Tabs sit at the bottom of the stack; detail screens like a chat push over them.
export const unstable_settings = { anchor: '(tabs)' };

export default function ConsultantLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand } }} />;
}

import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

// Tabs sit at the bottom of the stack; detail screens like a user record push over them.
export const unstable_settings = { anchor: '(tabs)' };

export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand } }} />;
}

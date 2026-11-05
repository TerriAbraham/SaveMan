import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}

// Each role only sees its own section; signing in or out switches section automatically.
function RootNavigator() {
  const { user } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sand } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={user?.role === 'client'}>
        <Stack.Screen name="client" />
      </Stack.Protected>
      <Stack.Protected guard={user?.role === 'consultant'}>
        <Stack.Screen name="consultant" />
      </Stack.Protected>
      <Stack.Protected guard={user?.role === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

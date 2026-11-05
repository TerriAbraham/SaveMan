import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';

import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth-context';

// NativeWind 4.2.7 touches ImageBackground at startup, which React Native 0.88 marks as deprecated.
// Harmless (the app doesn't use ImageBackground). https://github.com/nativewind/nativewind/issues/1881
LogBox.ignoreLogs(['ImageBackground is deprecated']);

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

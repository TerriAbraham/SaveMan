import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

// Matches the seeded accounts in src/data/users.ts.
const demoAccounts: { label: string; icon: IconName; email: string; password: string }[] = [
  { label: 'Client', icon: 'person', email: 'client@saveman.pg', password: 'client123' },
  { label: 'Consultant', icon: 'briefcase', email: 'consultant@saveman.pg', password: 'consult123' },
  { label: 'Admin', icon: 'dashboard', email: 'admin@saveman.pg', password: 'admin123' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    // On success the root layout switches to the user's section.
    setError(signIn(email, password));
  }

  return (
    <AuthScreen title="Welcome back" subtitle="Log in to manage your bookings and messages.">
      <TextField
        label="Email"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={handleLogin}
        returnKeyType="go"
      />

      {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}

      <Button title="Log in" onPress={handleLogin} />

      <View className="flex-row justify-center gap-1">
        <Text className="text-body text-fg-muted">New to SaveMan?</Text>
        <Pressable onPress={() => router.replace('/sign-up')} hitSlop={8}>
          <Text className="text-body font-bold text-red">Create an account</Text>
        </Pressable>
      </View>

      <View className="mt-2 gap-1 rounded-card bg-gold-tint p-4">
        <Text className="text-heading text-fg">Demo accounts</Text>
        <Text className="text-body text-fg-muted">Tap one to fill in its login details.</Text>
        <View className="mt-2 flex-row gap-2">
          {demoAccounts.map((d) => (
            <Pressable
              key={d.label}
              accessibilityRole="button"
              onPress={() => {
                setEmail(d.email);
                setPassword(d.password);
                setError(null);
              }}
              className="flex-1 items-center gap-1 rounded-xl border border-line bg-surface py-3 active:opacity-70">
              <Icon name={d.icon} size={20} color={colors.ink} />
              <Text className="text-label text-fg">{d.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </AuthScreen>
  );
}

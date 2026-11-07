import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Avatar } from '@/components/avatar';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { seedUsers } from '@/data/users';

// One seeded account per role (src/data/users.ts), so each dashboard is a tap away.
const roleAccounts: { role: string; text: string; icon: IconName; email: string; password: string }[] = [
  { role: 'Client', text: 'Find, book and message consultants', icon: 'person', email: 'client@saveman.pg', password: 'client123' },
  { role: 'Consultant', text: 'Manage bookings, services and hours', icon: 'briefcase', email: 'consultant@saveman.pg', password: 'consult123' },
  { role: 'Admin', text: 'Verify consultants and manage users', icon: 'dashboard', email: 'admin@saveman.pg', password: 'admin123' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    await logIn(email, password);
  }

  async function logIn(email: string, password: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    // 'done': the root layout switches to the user's section. Otherwise MFA comes next.
    if ('error' in result) setError(result.error);
    else if (result.next !== 'done') {
      setPassword('');
      router.push('/mfa-verify');
    }
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
      <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8} accessibilityRole="button" className="-mt-2 self-end">
        <Text className="text-label text-red">Forgot password?</Text>
      </Pressable>

      {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}

      <Button title="Log in" onPress={handleLogin} loading={busy} />

      <View className="flex-row justify-center gap-1">
        <Text className="text-body text-fg-muted">New to SaveMan?</Text>
        <Pressable onPress={() => router.replace('/sign-up')} hitSlop={8}>
          <Text className="text-body font-bold text-red">Create an account</Text>
        </Pressable>
      </View>

      <View className="mt-2 gap-3">
        <View className="gap-0.5">
          <Text className="text-heading text-fg">Continue as</Text>
          <Text className="text-body text-fg-muted">Pick a role to go straight to its dashboard.</Text>
        </View>
        {roleAccounts.map((a) => {
          // From the bundled demo accounts: the server doesn't share emails with logged-out visitors.
          const account = seedUsers.find((u) => u.email === a.email);
          return (
            <Pressable
              key={a.role}
              accessibilityRole="button"
              accessibilityLabel={`Continue as ${a.role}${account ? `, ${account.name}` : ''}`}
              disabled={busy}
              onPress={() => logIn(a.email, a.password)}
              className="flex-row items-center gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card active:opacity-80">
              {account ? <Avatar name={account.name} uri={account.avatarUri} /> : <Icon name={a.icon} size={22} color={colors.ink} />}
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Icon name={a.icon} size={14} color={colors.red} />
                  <Text className="text-label uppercase tracking-[1px] text-red">{a.role}</Text>
                </View>
                <Text className="text-heading text-fg">{account?.name ?? a.role}</Text>
                <Text className="text-caption text-fg-muted">{a.text}</Text>
              </View>
              <Icon name="chevronRight" size={20} color={colors.textMuted} />
            </Pressable>
          );
        })}
        <Text className="text-caption text-fg-muted">Consultant and admin accounts ask for a 6-digit code sent to their email.</Text>
      </View>
    </AuthScreen>
  );
}

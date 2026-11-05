import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors, radius, spacing, type } from '@/constants/theme';
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

      {error && <Text style={styles.error}>{error}</Text>}

      <Button title="Log in" onPress={handleLogin} />

      <View style={styles.switchRow}>
        <Text style={styles.muted}>New to SaveMan?</Text>
        <Pressable onPress={() => router.replace('/sign-up')} hitSlop={8}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </View>

      <View style={styles.demo}>
        <Text style={styles.demoTitle}>Demo accounts</Text>
        <Text style={styles.muted}>Tap one to fill in its login details.</Text>
        <View style={styles.demoRow}>
          {demoAccounts.map((d) => (
            <Pressable
              key={d.label}
              accessibilityRole="button"
              onPress={() => {
                setEmail(d.email);
                setPassword(d.password);
                setError(null);
              }}
              style={({ pressed }) => [styles.demoItem, pressed && { opacity: 0.7 }]}>
              <Icon name={d.icon} size={20} color={colors.ink} />
              <Text style={styles.demoLabel}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...type.label,
    color: colors.redDark,
    backgroundColor: colors.redTint,
    padding: spacing.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  muted: { ...type.body, color: colors.textMuted },
  link: { ...type.body, color: colors.red, fontWeight: '700' },
  demo: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.goldTint,
    gap: spacing.xs,
  },
  demoTitle: { ...type.heading, color: colors.text },
  demoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  demoItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoLabel: { ...type.label, color: colors.text },
});

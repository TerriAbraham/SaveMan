import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { authApi, errorMessage } from '@/api/auth-api';
import { AuthScreen } from '@/components/auth-screen';
import { Icon } from '@/components/icon';
import { CodeField } from '@/components/mfa/code-field';
import { DevCodeNotice } from '@/components/mfa/dev-code-notice';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useCooldown } from '@/hooks/use-cooldown';

type Proof = 'email' | 'reset' | 'app' | 'recovery';

const hints: Record<Exclude<Proof, 'email'>, string> = {
  reset: 'Ask a SaveMan administrator for a reset code. It works once, for 30 minutes.',
  app: 'Accounts with an authenticator app can use the 6-digit code it shows for SaveMan.',
  recovery: 'Or one of the recovery codes you saved when you set up the authenticator app.',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Forgotten password: a code emailed to the account, or (other ways) an admin's reset code or the authenticator. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [proof, setProof] = useState<Proof>('email');
  // Email: the code has been sent (devCode only when the server can't send email yet).
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const resend = useCooldown();

  function chooseProof(next: Proof) {
    setProof(next);
    setCode('');
    setError(null);
  }

  async function sendCode() {
    if (busy) return;
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter the email you log in with.');
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.requestPasswordReset(email.trim());
      setSent({ devCode: res.devCode });
      setCode('');
      resend.start(30);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy) return;
    if (!email.trim()) return setError('Enter the email you log in with.');
    if ((proof === 'email' || proof === 'app') && code.length !== 6) {
      return setError(proof === 'email' ? 'Enter the 6-digit code from the email.' : 'Enter the 6-digit code from your authenticator app.');
    }
    if ((proof === 'reset' || proof === 'recovery') && code.trim().length < 10) {
      return setError(`Enter the ${proof === 'reset' ? 'reset' : 'recovery'} code, e.g. K7QM2-XW9PD.`);
    }
    if (password.length < 6) return setError('Use at least 6 characters for your new password.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    setError(null);
    try {
      const value = code.trim();
      await authApi.resetPassword(
        email.trim(),
        password,
        proof === 'email' ? { emailCode: value } : proof === 'reset' ? { resetCode: value } : proof === 'app' ? { code: value } : { recoveryCode: value },
      );
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthScreen title="Password changed" subtitle="You can log in with your new password now.">
        <View className="flex-row items-center gap-3 rounded-card bg-forest-tint p-4">
          <Icon name="shield" size={22} color={colors.forest} />
          <Text className="flex-1 text-body text-fg">
            For your safety, SaveMan signed you out on every device. Accounts with two-step verification still need a code to log in.
          </Text>
        </View>
        <Button title="Back to log in" onPress={() => router.replace('/login')} />
      </AuthScreen>
    );
  }

  const errorBox = error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>;
  const backLink = (
    <Pressable onPress={() => router.replace('/login')} hitSlop={8} accessibilityRole="button" className="self-center">
      <Text className="text-body font-bold text-red">Back to log in</Text>
    </Pressable>
  );
  const emailField = (
    <TextField
      label="Email"
      icon="mail"
      value={email}
      onChangeText={(v) => {
        setEmail(v);
        setSent(null); // a different address needs its own code
        setError(null);
      }}
      placeholder="you@example.com"
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
      onSubmitEditing={proof === 'email' && !sent ? sendCode : undefined}
      returnKeyType={proof === 'email' && !sent ? 'send' : 'next'}
    />
  );

  // Step 1 of the usual way: the email address, then a code is sent to it.
  if (proof === 'email' && !sent) {
    return (
      <AuthScreen title="Reset your password" subtitle="We’ll email you a 6-digit code to set a new password.">
        {emailField}
        {errorBox}
        <Button title="Email me a code" onPress={sendCode} loading={busy} />
        <SwitchLink label="Other ways to reset" onPress={() => chooseProof('reset')} />
        {backLink}
      </AuthScreen>
    );
  }

  const passwordFields = (
    <>
      <TextField
        label="New password"
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm new password"
        icon="lock"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
    </>
  );

  // Step 2: the emailed code and a new password.
  if (proof === 'email') {
    return (
      <AuthScreen title="Check your email" subtitle="Enter the code we sent, then choose a new password.">
        <View className="flex-row items-start gap-3 rounded-card bg-forest-tint p-4">
          <Icon name="mail" size={20} color={colors.forest} />
          <Text className="flex-1 text-body text-fg">
            If <Text className="font-bold">{email.trim()}</Text> has a SaveMan account, we’ve emailed it a 6-digit code. It works for 10
            minutes. Check your spam folder if it isn’t in your inbox.
          </Text>
        </View>
        {sent?.devCode && <DevCodeNotice code={sent.devCode} />}
        <CodeField value={code} onChangeText={setCode} autoFocus />
        {passwordFields}
        {errorBox}
        <Button title="Change password" onPress={submit} loading={busy} />
        <Pressable onPress={sendCode} disabled={busy || resend.seconds > 0} hitSlop={8} accessibilityRole="button" className="self-center">
          <Text className={`text-body font-bold ${busy || resend.seconds > 0 ? 'text-fg-muted' : 'text-red'}`}>
            {resend.seconds > 0 ? `Send a new code in ${resend.seconds}s` : 'Send a new code'}
          </Text>
        </Pressable>
        <SwitchLink label="Use a different email" onPress={() => setSent(null)} />
        {backLink}
      </AuthScreen>
    );
  }

  // Other ways: an administrator's reset code, or the authenticator app (or a recovery code).
  return (
    <AuthScreen title="Reset your password" subtitle="Prove it’s your account, then choose a new password.">
      {emailField}

      <View className="gap-2">
        <SegmentedControl
          surface="surface"
          value={proof}
          onChange={chooseProof}
          segments={[
            { value: 'reset', label: 'Reset code' },
            { value: 'app', label: 'Authenticator' },
            { value: 'recovery', label: 'Recovery' },
          ]}
        />
        <Text className="text-caption text-fg-muted">{hints[proof]}</Text>
      </View>

      {proof === 'app' ? (
        <CodeField value={code} onChangeText={setCode} />
      ) : (
        <TextField
          label={proof === 'reset' ? 'Reset code' : 'Recovery code'}
          icon="key"
          value={code}
          onChangeText={setCode}
          placeholder="XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
      )}

      {passwordFields}
      {errorBox}

      <Button title="Change password" onPress={submit} loading={busy} />
      <SwitchLink label="Email me a code instead" onPress={() => chooseProof('email')} />
      {backLink}
    </AuthScreen>
  );
}

function SwitchLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" className="self-center">
      <Text className="text-body font-bold text-red">{label}</Text>
    </Pressable>
  );
}

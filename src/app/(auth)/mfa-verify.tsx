import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ApiError, errorMessage, type MfaVerifyResponse } from '@/api/auth-api';
import { AuthScreen } from '@/components/auth-screen';
import { Icon } from '@/components/icon';
import { CodeField } from '@/components/mfa/code-field';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

/** Second step of login for accounts with MFA on: a code from the authenticator, or a recovery code. */
export default function MfaVerifyScreen() {
  const router = useRouter();
  const { user, pendingMfa, verifyMfa, completeSignIn, cancelMfa } = useAuth();
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Shown after a recovery code is used, before going into the app.
  const [recovered, setRecovered] = useState<MfaVerifyResponse | null>(null);

  if (user) return null; // signed in: the root layout is switching sections
  if (!pendingMfa || pendingMfa.kind !== 'verify') return <Redirect href="/login" />;

  function backToLogin() {
    cancelMfa();
    router.replace('/login');
  }

  async function submit(value = mode === 'code' ? code : recoveryCode) {
    if (busy) return;
    if (mode === 'code' && value.length !== 6) return setError('Enter the 6-digit code from your authenticator app.');
    if (mode === 'recovery' && value.trim().length < 10) return setError('Enter one of your recovery codes, e.g. K7QM2-XW9PD.');
    setBusy(true);
    setError(null);
    try {
      const res = await verifyMfa(mode === 'code' ? { code: value } : { recoveryCode: value });
      if (res.usedRecoveryCode) setRecovered(res);
      else completeSignIn(res); // the root layout switches to the user's section
    } catch (err) {
      setBusy(false);
      setCode('');
      // Expired, or too many tries on this login: the password is needed again.
      if (err instanceof ApiError && err.code === 'unauthorized') {
        setError('This login has expired. Go back and enter your password again.');
      } else {
        setError(errorMessage(err));
      }
    }
  }

  if (recovered) {
    const left = recovered.recoveryCodesRemaining;
    return (
      <AuthScreen title="Recovery code used" subtitle="That code can’t be used again.">
        <View className="flex-row items-start gap-3 rounded-card bg-gold-tint p-4">
          <Icon name="key" size={20} color={colors.inkSoft} />
          <Text className="flex-1 text-body text-fg">
            You have {left} recovery code{left === 1 ? '' : 's'} left. If you’ve lost your phone, open{' '}
            <Text className="font-bold">Security</Text> (on your Profile tab, or the Overview for admins) and choose “Move to a new
            phone”, then make new recovery codes.
          </Text>
        </View>
        <Button title="Continue" onPress={() => completeSignIn(recovered)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Two-step verification" subtitle={`Enter the code for ${pendingMfa.user.email} to finish logging in.`}>
      <View className="flex-row items-start gap-3 rounded-card bg-forest-tint p-4">
        <Icon name="shield" size={20} color={colors.forest} />
        <Text className="flex-1 text-body text-fg">
          {mode === 'code'
            ? 'Open Google Authenticator or Microsoft Authenticator and enter the 6-digit code shown for SaveMan.'
            : 'Enter one of the recovery codes you saved when you set up two-step verification. Each one works once.'}
        </Text>
      </View>

      {mode === 'code' ? (
        <CodeField
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(v) => submit(v)}
          error={error}
          autoFocus
        />
      ) : (
        <TextField
          label="Recovery code"
          icon="key"
          value={recoveryCode}
          onChangeText={(v) => {
            setRecoveryCode(v);
            setError(null);
          }}
          placeholder="XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          onSubmitEditing={() => submit()}
          returnKeyType="go"
          error={error ?? undefined}
        />
      )}

      <Button title="Verify" onPress={() => submit()} loading={busy} />

      <Pressable
        onPress={() => {
          setMode(mode === 'code' ? 'recovery' : 'code');
          setError(null);
        }}
        hitSlop={8}
        accessibilityRole="button"
        className="self-center">
        <Text className="text-body font-bold text-red">
          {mode === 'code' ? 'Lost your phone? Use a recovery code' : 'Use the code from my authenticator app'}
        </Text>
      </Pressable>
      <Pressable onPress={backToLogin} hitSlop={8} accessibilityRole="button" className="self-center">
        <Text className="text-body text-fg-muted">Back to login</Text>
      </Pressable>
    </AuthScreen>
  );
}

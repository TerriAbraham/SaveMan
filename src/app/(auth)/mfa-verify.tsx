import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ApiError, errorMessage, type LoginFactor, type MfaVerifyResponse } from '@/api/auth-api';
import { AuthScreen } from '@/components/auth-screen';
import { Icon } from '@/components/icon';
import { CodeField } from '@/components/mfa/code-field';
import { DevCodeNotice } from '@/components/mfa/dev-code-notice';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCooldown } from '@/hooks/use-cooldown';

type Mode = 'email' | 'code' | 'recovery';

/**
 * Second step of login: the 6-digit code emailed to the account or, for accounts with an
 * authenticator app, its code or a recovery code.
 */
export default function MfaVerifyScreen() {
  const router = useRouter();
  const { user, pendingMfa, verifyMfa, sendLoginCode, completeSignIn, cancelMfa } = useAuth();
  const [mode, setMode] = useState<Mode>(pendingMfa?.methods.authenticator ? 'code' : 'email');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(pendingMfa?.emailError ?? null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const resend = useCooldown(pendingMfa?.email ? 30 : 0);
  // Shown after a recovery code is used, before going into the app.
  const [recovered, setRecovered] = useState<MfaVerifyResponse | null>(null);

  // Authenticator users who pick email get a code sent the first time they switch.
  const needsEmail = mode === 'email' && !!pendingMfa && !pendingMfa.email && !pendingMfa.emailError;
  useEffect(() => {
    if (needsEmail) sendCode();
    // sendCode is recreated each render; this runs once per switch to email.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsEmail]);

  if (user) return null; // signed in: the root layout is switching sections
  if (!pendingMfa) return <Redirect href="/login" />;

  function backToLogin() {
    cancelMfa();
    router.replace('/login');
  }

  async function sendCode() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await sendLoginCode();
      setCode('');
      resend.start(30);
    } catch (err) {
      setError(expiredOr(err));
    } finally {
      setSending(false);
    }
  }

  async function submit(value = mode === 'recovery' ? recoveryCode : code) {
    if (busy) return;
    if (mode !== 'recovery' && value.length !== 6) {
      return setError(mode === 'email' ? 'Enter the 6-digit code from the email.' : 'Enter the 6-digit code from your authenticator app.');
    }
    if (mode === 'recovery' && value.trim().length < 10) return setError('Enter one of your recovery codes, e.g. K7QM2-XW9PD.');
    setBusy(true);
    setError(null);
    try {
      const factor: LoginFactor = mode === 'email' ? { emailCode: value } : mode === 'code' ? { code: value } : { recoveryCode: value };
      const res = await verifyMfa(factor);
      if (res.usedRecoveryCode) setRecovered(res);
      else completeSignIn(res); // the root layout switches to the user's section
    } catch (err) {
      setBusy(false);
      setCode('');
      setError(expiredOr(err));
    }
  }

  function switchTo(next: Mode) {
    setMode(next);
    setCode('');
    setError(null);
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

  const sentTo = pendingMfa.email?.sentTo ?? pendingMfa.methods.email;
  const intro =
    mode === 'email'
      ? pendingMfa.email
        ? `We emailed a 6-digit code to ${sentTo}. It works for 10 minutes. Check your spam folder if it isn’t in your inbox.`
        : sending
          ? `Sending a code to ${sentTo}…`
          : `We’ll email a 6-digit code to ${sentTo}.`
      : mode === 'code'
        ? 'Open Google Authenticator or Microsoft Authenticator and enter the 6-digit code shown for SaveMan.'
        : 'Enter one of the recovery codes you saved when you set up your authenticator app. Each one works once.';

  return (
    <AuthScreen title="Two-step verification" subtitle={`Enter the code for ${pendingMfa.user.email} to finish logging in.`}>
      <View className="flex-row items-start gap-3 rounded-card bg-forest-tint p-4">
        <Icon name={mode === 'email' ? 'mail' : 'shield'} size={20} color={colors.forest} />
        <Text className="flex-1 text-body text-fg">{intro}</Text>
      </View>

      {mode === 'email' && pendingMfa.email?.devCode && <DevCodeNotice code={pendingMfa.email.devCode} />}

      {mode === 'recovery' ? (
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
      ) : (
        <CodeField
          // A new key per mode clears the boxes and focus between email and authenticator.
          key={mode}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(v) => submit(v)}
          error={error}
          autoFocus
        />
      )}

      <Button title="Verify" onPress={() => submit()} loading={busy} />

      {mode === 'email' && (
        <Pressable
          onPress={sendCode}
          disabled={sending || resend.seconds > 0}
          hitSlop={8}
          accessibilityRole="button"
          className="self-center">
          <Text className={`text-body font-bold ${sending || resend.seconds > 0 ? 'text-fg-muted' : 'text-red'}`}>
            {sending ? 'Sending…' : resend.seconds > 0 ? `Send a new code in ${resend.seconds}s` : 'Send a new code'}
          </Text>
        </Pressable>
      )}
      {pendingMfa.methods.authenticator && (
        <>
          {mode !== 'code' && <SwitchLink label="Use the code from my authenticator app" onPress={() => switchTo('code')} />}
          {mode !== 'email' && <SwitchLink label="Email me a code instead" onPress={() => switchTo('email')} />}
          {mode !== 'recovery' && <SwitchLink label="Lost your phone? Use a recovery code" onPress={() => switchTo('recovery')} />}
        </>
      )}
      <Pressable onPress={backToLogin} hitSlop={8} accessibilityRole="button" className="self-center">
        <Text className="text-body text-fg-muted">Back to login</Text>
      </Pressable>
    </AuthScreen>
  );
}

/** Expired, or too many tries on this login: the password is needed again. */
function expiredOr(err: unknown) {
  return err instanceof ApiError && err.code === 'unauthorized' ? 'This login has expired. Go back and enter your password again.' : errorMessage(err);
}

function SwitchLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" className="self-center">
      <Text className="text-body font-bold text-red">{label}</Text>
    </Pressable>
  );
}

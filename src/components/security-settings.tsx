import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi, errorMessage, type MfaSetupData, type MfaStatus, type SecondFactor } from '@/api/auth-api';
import { Icon } from '@/components/icon';
import { AuthenticatorSetup } from '@/components/mfa/authenticator-setup';
import { CodeField } from '@/components/mfa/code-field';
import { DevCodeNotice } from '@/components/mfa/dev-code-notice';
import { RecoveryCodes } from '@/components/mfa/recovery-codes';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCooldown } from '@/hooks/use-cooldown';

type Mode =
  | { name: 'view' }
  | { name: 'emailOn'; sentTo: string; devCode?: string } // enter the code that turns on emailed login codes
  | { name: 'emailOff' }
  | { name: 'setup'; setup: MfaSetupData }
  | { name: 'move' } // confirm identity before moving MFA to a new phone
  | { name: 'regenerate' }
  | { name: 'disable' }
  | { name: 'password' }
  | { name: 'codes'; codes: string[] };

/**
 * Password and two-step verification: change password; emailed login codes (always on for admins
 * and consultants, a choice for clients); and an optional authenticator app with recovery codes.
 */
export function SecuritySettings({ fallbackHref }: { fallbackHref: Href }) {
  const insets = useSafeAreaInsets();
  const {
    user,
    token,
    getMfaStatus,
    startMfaSetup,
    confirmMfaSetup,
    regenerateRecoveryCodes,
    disableMfa,
    startEmailMfa,
    enableEmailMfa,
    disableEmailMfa,
  } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [mode, setMode] = useState<Mode>({ name: 'view' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let live = true;
    getMfaStatus()
      .then((s) => live && setStatus(s))
      .catch((err) => live && setError(errorMessage(err)));
    return () => {
      live = false;
    };
    // Re-fetched after each change via refreshKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (!user) return null;

  const refresh = () => setRefreshKey((k) => k + 1);
  const back = () => {
    setMode({ name: 'view' });
    setError(null);
  };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const turnOn = () => run(async () => setMode({ name: 'setup', setup: await startMfaSetup() }));
  const sendEnableCode = () => run(async () => setMode({ name: 'emailOn', ...(await startEmailMfa()) }));

  async function confirmSetup(code: string) {
    const res = await confirmMfaSetup(code);
    setMode({ name: 'codes', codes: res.recoveryCodes });
    refresh();
  }

  let body;
  if (mode.name === 'emailOn') {
    body = (
      <ConfirmEmailCode
        sentTo={mode.sentTo}
        devCode={mode.devCode}
        busy={busy}
        onResend={sendEnableCode}
        onSubmit={(code) =>
          run(async () => {
            await enableEmailMfa(code);
            back();
            refresh();
            setNotice('Emailed login codes are on. Next time you log in, we’ll email you a code.');
          })
        }
      />
    );
  } else if (mode.name === 'emailOff') {
    body = (
      <ConfirmPassword
        title="Turn off emailed login codes"
        description="Logging in will need your password only."
        submitLabel="Turn off"
        busy={busy}
        onSubmit={(password) =>
          run(async () => {
            await disableEmailMfa(password);
            back();
            refresh();
          })
        }
      />
    );
  } else if (mode.name === 'setup') {
    body = <AuthenticatorSetup setup={mode.setup} onConfirm={confirmSetup} />;
  } else if (mode.name === 'codes') {
    body = (
      <>
        <RecoveryCodes codes={mode.codes} email={user.email} />
        <Button title="I’ve saved my codes" onPress={back} />
      </>
    );
  } else if (mode.name === 'move') {
    body = (
      <ConfirmIdentity
        title="Move to a new phone"
        description="Confirm it’s you. Your current authenticator keeps working until the new one is set up."
        askPassword
        allowRecovery
        submitLabel="Continue"
        busy={busy}
        onSubmit={(password, factor) => run(async () => setMode({ name: 'setup', setup: await startMfaSetup({ password, ...factor }) }))}
      />
    );
  } else if (mode.name === 'regenerate') {
    body = (
      <ConfirmIdentity
        title="Make new recovery codes"
        description="Enter a code from your authenticator app. Your old recovery codes will stop working."
        submitLabel="Make new codes"
        busy={busy}
        onSubmit={(_, factor) =>
          run(async () => {
            setMode({ name: 'codes', codes: await regenerateRecoveryCodes('code' in factor ? factor.code : '') });
            refresh();
          })
        }
      />
    );
  } else if (mode.name === 'disable') {
    body = (
      <ConfirmIdentity
        title="Remove the authenticator app"
        description={
          status?.emailEnabled
            ? 'Logging in will use the code we email you. Your recovery codes will be deleted.'
            : 'Your account will be protected by your password only. Your recovery codes will be deleted.'
        }
        askPassword
        allowRecovery
        danger
        submitLabel="Remove"
        busy={busy}
        onSubmit={(password, factor) =>
          run(async () => {
            await disableMfa(password, factor);
            back();
            refresh();
          })
        }
      />
    );
  } else if (mode.name === 'password') {
    body = (
      <ChangePassword
        busy={busy}
        onSubmit={(current, next) =>
          run(async () => {
            if (!token) throw new Error();
            await authApi.changePassword(token, current, next);
            back();
            setNotice('Password changed. You’ve been signed out on your other devices.');
          })
        }
      />
    );
  } else if (!status) {
    body = error ? null : <ActivityIndicator color={colors.red} className="py-8" />;
  } else {
    const on = status.emailEnabled || status.enabled;
    const how =
      status.emailEnabled && status.enabled
        ? `a 6-digit code emailed to ${user.email}, or one from your authenticator app`
        : status.emailEnabled
          ? `a 6-digit code emailed to ${user.email}`
          : 'a 6-digit code from your authenticator app';
    body = (
      <>
        <View className="gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
          <View className="flex-row items-center gap-3">
            <View className={`h-10 w-10 items-center justify-center rounded-full ${on ? 'bg-forest-tint' : 'bg-sand'}`}>
              <Icon name="shield" size={20} color={on ? colors.forest : colors.textMuted} />
            </View>
            <View className="flex-1">
              <Text className="text-heading text-fg">Two-step verification</Text>
              <Text className={`text-label ${on ? 'text-forest' : 'text-fg-muted'}`}>{on ? 'On' : 'Off'}</Text>
            </View>
          </View>
          <Text className="text-body text-fg-muted">
            {status.required
              ? `Required for your account. Each login needs your password and ${how}.`
              : on
                ? `Each login needs your password and ${how}.`
                : 'Get a 6-digit code by email each time you log in, so a stolen password isn’t enough.'}
          </Text>
          {!status.emailEnabled && <Button title="Email me a code at each login" onPress={sendEnableCode} loading={busy} />}
          {status.emailEnabled && !status.required && (
            <Row icon="mail" title="Turn off emailed codes" detail="Your password is needed" danger onPress={() => setMode({ name: 'emailOff' })} />
          )}
        </View>

        <View className="gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
          <View className="gap-1">
            <Text className="text-heading text-fg">Authenticator app</Text>
            <Text className={`text-label ${status.enabled ? 'text-forest' : 'text-fg-muted'}`}>{status.enabled ? 'Set up' : 'Optional'}</Text>
          </View>
          {status.enabled ? (
            <View className="-mx-2 gap-1">
              <Row
                icon="key"
                title="Recovery codes"
                detail={`${status.recoveryCodesRemaining} of 10 left${status.recoveryCodesRemaining <= 3 ? ', make new ones soon' : ''}`}
                onPress={() => setMode({ name: 'regenerate' })}
              />
              <Row icon="phone" title="Move to a new phone" detail="Set up a different authenticator" onPress={() => setMode({ name: 'move' })} />
              <Row icon="lock" title="Remove" detail="Password and code needed" danger onPress={() => setMode({ name: 'disable' })} />
            </View>
          ) : (
            <>
              <Text className="text-body text-fg-muted">
                Use Google Authenticator or Microsoft Authenticator for login codes that work without waiting for an email.
              </Text>
              <Button title="Set up an authenticator app" variant="outline" onPress={turnOn} loading={busy} />
            </>
          )}
        </View>

        <View className="gap-1 rounded-card border border-line/70 bg-surface p-2 shadow-card">
          <Row icon="lock" title="Change password" detail="Your current password is needed" onPress={() => setMode({ name: 'password' })} />
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Security" subtitle={user.email} fallbackHref={fallbackHref} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {notice && <Text className="overflow-hidden rounded-lg bg-forest-tint p-3 text-label text-forest">{notice}</Text>}
        {body}
        {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}
        {mode.name !== 'view' && mode.name !== 'codes' && <Button title="Cancel" variant="outline" onPress={back} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The emailed code that turns on emailed login codes. */
function ConfirmEmailCode({
  sentTo,
  devCode,
  busy,
  onResend,
  onSubmit,
}: {
  sentTo: string;
  devCode?: string;
  busy: boolean;
  onResend: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resend = useCooldown(30);

  function submit(value = code) {
    if (value.length !== 6) return setError('Enter the 6-digit code from the email.');
    setError(null);
    onSubmit(value);
  }

  return (
    <View className="gap-4 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <View className="gap-1">
        <Text className="text-heading text-fg">Check your email</Text>
        <Text className="text-body text-fg-muted">
          We emailed a 6-digit code to {sentTo}. Enter it to confirm the address and turn on emailed login codes.
        </Text>
      </View>
      {devCode && <DevCodeNotice code={devCode} />}
      <CodeField value={code} onChangeText={setCode} onComplete={submit} error={error} autoFocus />
      <Button title="Turn on" onPress={() => submit()} loading={busy} />
      <Pressable
        onPress={() => {
          setCode('');
          resend.start(30);
          onResend();
        }}
        disabled={busy || resend.seconds > 0}
        hitSlop={8}
        accessibilityRole="button"
        className="self-start">
        <Text className={`text-label ${busy || resend.seconds > 0 ? 'text-fg-muted' : 'text-red'}`}>
          {resend.seconds > 0 ? `Send a new code in ${resend.seconds}s` : 'Send a new code'}
        </Text>
      </Pressable>
    </View>
  );
}

function ConfirmPassword({
  title,
  description,
  submitLabel,
  busy,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!password) return setError('Enter your password.');
    setError(null);
    onSubmit(password);
  }

  return (
    <View className="gap-4 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <View className="gap-1">
        <Text className="text-heading text-fg">{title}</Text>
        <Text className="text-body text-fg-muted">{description}</Text>
      </View>
      <TextField
        label="Password"
        icon="lock"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      {error && <Text className="text-caption text-red-dark">{error}</Text>}
      <Button title={submitLabel} variant="secondary" onPress={submit} loading={busy} />
    </View>
  );
}

function Row({
  icon,
  title,
  detail,
  danger,
  onPress,
}: {
  icon: 'key' | 'phone' | 'lock' | 'mail';
  title: string;
  detail: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 rounded-xl p-3 active:bg-sand">
      <Icon name={icon} size={20} color={danger ? colors.redDark : colors.textMuted} />
      <View className="flex-1">
        <Text className={`text-body font-semibold ${danger ? 'text-red-dark' : 'text-fg'}`}>{title}</Text>
        <Text className="text-caption text-fg-muted">{detail}</Text>
      </View>
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function ChangePassword({ busy, onSubmit }: { busy: boolean; onSubmit: (current: string, next: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!current) return setError('Enter your current password.');
    if (next.length < 6) return setError('Use at least 6 characters for your new password.');
    if (next !== confirm) return setError('The two new passwords don’t match.');
    if (next === current) return setError('Choose a password different from your current one.');
    setError(null);
    onSubmit(current, next);
  }

  return (
    <View className="gap-4 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <View className="gap-1">
        <Text className="text-heading text-fg">Change password</Text>
        <Text className="text-body text-fg-muted">You’ll stay logged in here. Your other devices will be signed out.</Text>
      </View>
      <TextField label="Current password" icon="lock" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <TextField
        label="New password"
        icon="lock"
        value={next}
        onChangeText={setNext}
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
      />
      {error && <Text className="text-caption text-red-dark">{error}</Text>}
      <Button title="Change password" onPress={submit} loading={busy} />
    </View>
  );
}

/** Password (optional) plus an authenticator code, or a recovery code when `allowRecovery`. */
function ConfirmIdentity({
  title,
  description,
  askPassword,
  allowRecovery,
  danger,
  submitLabel,
  busy,
  onSubmit,
}: {
  title: string;
  description: string;
  askPassword?: boolean;
  allowRecovery?: boolean;
  danger?: boolean;
  submitLabel: string;
  busy: boolean;
  onSubmit: (password: string, factor: SecondFactor) => void;
}) {
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (askPassword && !password) return setError('Enter your password.');
    if (!useRecovery && code.length !== 6) return setError('Enter the 6-digit code from your authenticator app.');
    if (useRecovery && recoveryCode.trim().length < 10) return setError('Enter one of your recovery codes.');
    setError(null);
    onSubmit(password, useRecovery ? { recoveryCode } : { code });
  }

  return (
    <View className="gap-4 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <View className="gap-1">
        <Text className="text-heading text-fg">{title}</Text>
        <Text className="text-body text-fg-muted">{description}</Text>
      </View>
      {askPassword && (
        <TextField label="Password" icon="lock" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      )}
      {useRecovery ? (
        <TextField
          label="Recovery code"
          icon="key"
          value={recoveryCode}
          onChangeText={setRecoveryCode}
          placeholder="XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
      ) : (
        <CodeField value={code} onChangeText={setCode} />
      )}
      {allowRecovery && (
        <Pressable onPress={() => setUseRecovery((r) => !r)} hitSlop={8} accessibilityRole="button" className="self-start">
          <Text className="text-label text-red">{useRecovery ? 'Use my authenticator code' : 'Use a recovery code instead'}</Text>
        </Pressable>
      )}
      {error && <Text className="text-caption text-red-dark">{error}</Text>}
      <Button title={submitLabel} variant={danger ? 'secondary' : 'primary'} onPress={submit} loading={busy} />
    </View>
  );
}

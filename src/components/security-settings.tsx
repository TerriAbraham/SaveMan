import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';

import { authApi, errorMessage, type MfaSetupData, type MfaStatus, type SecondFactor } from '@/api/auth-api';
import { Icon } from '@/components/icon';
import { AuthenticatorSetup } from '@/components/mfa/authenticator-setup';
import { CodeField } from '@/components/mfa/code-field';
import { RecoveryCodes } from '@/components/mfa/recovery-codes';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

type Mode =
  | { name: 'view' }
  | { name: 'setup'; setup: MfaSetupData }
  | { name: 'move' } // confirm identity before moving MFA to a new phone
  | { name: 'regenerate' }
  | { name: 'disable' }
  | { name: 'password' }
  | { name: 'codes'; codes: string[] };

/**
 * Password and two-step verification: change password, turn MFA on (clients), move it to a new
 * phone, new recovery codes, turn it off (clients).
 */
export function SecuritySettings({ fallbackHref }: { fallbackHref: Href }) {
  const { user, token, getMfaStatus, startMfaSetup, confirmMfaSetup, regenerateRecoveryCodes, disableMfa } = useAuth();
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

  async function confirmSetup(code: string) {
    const res = await confirmMfaSetup(code);
    setMode({ name: 'codes', codes: res.recoveryCodes });
    refresh();
  }

  let body;
  if (mode.name === 'setup') {
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
        title="Turn off two-step verification"
        description="Your account will be protected by your password only. Your recovery codes will be deleted."
        askPassword
        allowRecovery
        danger
        submitLabel="Turn off"
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
    body = (
      <>
        <View className="gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
          <View className="flex-row items-center gap-3">
            <View className={`h-10 w-10 items-center justify-center rounded-full ${status.enabled ? 'bg-forest-tint' : 'bg-sand'}`}>
              <Icon name="shield" size={20} color={status.enabled ? colors.forest : colors.textMuted} />
            </View>
            <View className="flex-1">
              <Text className="text-heading text-fg">Two-step verification</Text>
              <Text className={`text-label ${status.enabled ? 'text-forest' : 'text-fg-muted'}`}>{status.enabled ? 'On' : 'Off'}</Text>
            </View>
          </View>
          <Text className="text-body text-fg-muted">
            {status.required
              ? 'Required for your account. Each login needs your password and a 6-digit code from your authenticator app.'
              : status.enabled
                ? 'Each login needs your password and a 6-digit code from your authenticator app.'
                : 'Add a 6-digit code from Google Authenticator or Microsoft Authenticator to each login, so a stolen password isn’t enough.'}
          </Text>
          {!status.enabled && <Button title="Turn on" onPress={turnOn} loading={busy} />}
        </View>

        {status.enabled && (
          <View className="gap-1 rounded-card border border-line/70 bg-surface p-2 shadow-card">
            <Row
              icon="key"
              title="Recovery codes"
              detail={`${status.recoveryCodesRemaining} of 10 left${status.recoveryCodesRemaining <= 3 ? ', make new ones soon' : ''}`}
              onPress={() => setMode({ name: 'regenerate' })}
            />
            <Row icon="phone" title="Move to a new phone" detail="Set up a different authenticator" onPress={() => setMode({ name: 'move' })} />
            {!status.required && (
              <Row icon="lock" title="Turn off" detail="Password and code needed" danger onPress={() => setMode({ name: 'disable' })} />
            )}
          </View>
        )}

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
        contentContainerClassName="gap-4 px-4 pt-4 pb-safe-offset-6">
        {notice && <Text className="overflow-hidden rounded-lg bg-forest-tint p-3 text-label text-forest">{notice}</Text>}
        {body}
        {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}
        {mode.name !== 'view' && mode.name !== 'codes' && <Button title="Cancel" variant="outline" onPress={back} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({ icon, title, detail, danger, onPress }: { icon: 'key' | 'phone' | 'lock'; title: string; detail: string; danger?: boolean; onPress: () => void }) {
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

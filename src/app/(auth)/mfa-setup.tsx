import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { errorMessage, type MfaEnableResponse, type MfaSetupData } from '@/api/auth-api';
import { AuthScreen } from '@/components/auth-screen';
import { Icon } from '@/components/icon';
import { AuthenticatorSetup } from '@/components/mfa/authenticator-setup';
import { RecoveryCodes } from '@/components/mfa/recovery-codes';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

const roleNames = { admin: 'Administrator', consultant: 'Consultant', client: 'Client' } as const;

/** First login of an admin or consultant: they must enrol an authenticator before getting in. */
export default function MfaSetupScreen() {
  const router = useRouter();
  const { user, pendingMfa, startMfaSetup, confirmMfaSetup, completeSignIn, cancelMfa } = useAuth();
  const [setup, setSetup] = useState<MfaSetupData | null>(null);
  const [enabled, setEnabled] = useState<MfaEnableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const isSetup = pendingMfa?.kind === 'setup';

  useEffect(() => {
    if (!isSetup || started.current) return;
    started.current = true;
    startMfaSetup()
      .then(setSetup)
      .catch((err) => setError(errorMessage(err)));
  }, [isSetup, startMfaSetup]);

  if (user) return null; // signed in: the root layout is switching sections
  if (!pendingMfa || (!isSetup && !enabled)) return <Redirect href="/login" />;

  function backToLogin() {
    cancelMfa();
    router.replace('/login');
  }

  if (enabled) {
    return (
      <AuthScreen title="Save your recovery codes" subtitle="Two-step verification is now on.">
        <RecoveryCodes codes={enabled.recoveryCodes} email={enabled.user.email} />
        <Button title="I’ve saved my codes, continue" onPress={() => completeSignIn(enabled)} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Set up two-step verification" subtitle={`Required for ${roleNames[pendingMfa.user.role]} accounts.`}>
      <View className="flex-row items-start gap-3 rounded-card bg-forest-tint p-4">
        <Icon name="shield" size={20} color={colors.forest} />
        <Text className="flex-1 text-body text-fg">
          Each time you log in, SaveMan will ask for a 6-digit code from an authenticator app on your phone as well as your password.
        </Text>
      </View>

      {error ? (
        <View className="gap-3">
          <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>
          <Button title="Back to login" variant="outline" onPress={backToLogin} />
        </View>
      ) : setup ? (
        <AuthenticatorSetup setup={setup} onConfirm={async (code) => setEnabled(await confirmMfaSetup(code))} />
      ) : (
        <ActivityIndicator color={colors.red} className="py-8" />
      )}

      {!error && (
        <Pressable onPress={backToLogin} hitSlop={8} accessibilityRole="button" className="self-center">
          <Text className="text-body text-fg-muted">Cancel and go back to login</Text>
        </Pressable>
      )}
    </AuthScreen>
  );
}

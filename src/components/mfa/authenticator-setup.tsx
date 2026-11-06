import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';

import { errorMessage, type MfaSetupData } from '@/api/auth-api';
import { Icon } from '@/components/icon';
import { CodeField } from '@/components/mfa/code-field';
import { Button } from '@/components/ui/button';
import { SmallButton } from '@/components/ui/small-button';
import { colors } from '@/constants/theme';

/**
 * Add the secret to Google Authenticator / Microsoft Authenticator, then confirm with its first code.
 * The QR is for scanning from another screen; on the same phone, "Open in authenticator" or the key works.
 */
export function AuthenticatorSetup({ setup, onConfirm }: { setup: MfaSetupData; onConfirm: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const groupedKey = setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret;

  async function confirm(value = code) {
    if (busy) return;
    if (value.length !== 6) {
      setError('Enter the 6-digit code shown in your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(value);
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function openInApp() {
    setLinkError(null);
    try {
      await Linking.openURL(setup.otpauthUrl);
    } catch {
      setLinkError('No authenticator app opened. Install one, or copy the setup key below.');
    }
  }

  return (
    <View className="gap-4">
      <Step number={1} title="Get an authenticator app">
        <Text className="text-body text-fg-muted">Google Authenticator or Microsoft Authenticator, free from the App Store or Google Play.</Text>
      </Step>

      <Step number={2} title="Add your SaveMan account">
        <View className="items-center rounded-xl border border-line bg-white p-3">
          {/* Fixed pixel size for the QR image, so it stays in style. */}
          <Image source={{ uri: setup.qrDataUrl }} style={{ width: 200, height: 200 }} contentFit="contain" accessibilityLabel="QR code for your authenticator app" />
        </View>
        <Text className="text-caption text-fg-muted">
          Scan the QR code with the authenticator app on another device. On this phone, open the app directly or enter the key by
          hand (choose “Time based”).
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <SmallButton icon="external" label="Open in authenticator" onPress={openInApp} />
          <SmallButton
            icon="copy"
            variant="outline"
            label={copied ? 'Key copied' : 'Copy key'}
            onPress={async () => {
              await Clipboard.setStringAsync(setup.secret);
              setCopied(true);
            }}
          />
        </View>
        {linkError && <Text className="text-caption text-red-dark">{linkError}</Text>}
        <View className="flex-row items-center gap-2 rounded-lg bg-sand px-3 py-2.5">
          <Icon name="key" size={16} color={colors.textMuted} />
          <Text selectable className="flex-1 font-mono text-[14px] font-semibold tracking-wider text-fg">
            {groupedKey}
          </Text>
        </View>
      </Step>

      <Step number={3} title="Enter the code it shows">
        <CodeField
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(v) => confirm(v)}
          error={error}
        />
        <Button title="Verify and turn on" onPress={() => confirm()} loading={busy} />
      </Step>
    </View>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <View className="flex-row items-center gap-3">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-ink">
          <Text className="text-label text-on-dark">{number}</Text>
        </View>
        <Text className="flex-1 text-heading text-fg">{title}</Text>
      </View>
      {children}
    </View>
  );
}

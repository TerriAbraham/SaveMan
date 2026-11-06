import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { SmallButton } from '@/components/ui/small-button';
import { colors } from '@/constants/theme';

/** Freshly made recovery codes. The server only keeps hashes, so this is the one time they're shown. */
export function RecoveryCodes({ codes, email }: { codes: string[]; email: string }) {
  const [copied, setCopied] = useState(false);
  const text = `SaveMan recovery codes for ${email}\nEach code works once.\n\n${codes.join('\n')}`;

  return (
    <View className="gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <View className="flex-row items-start gap-3 rounded-xl bg-gold-tint p-3">
        <Icon name="lock" size={18} color={colors.inkSoft} />
        <Text className="flex-1 text-body text-fg">
          Save these somewhere safe, away from your phone. If you lose your phone, each code lets you log in once. They won’t be
          shown again.
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {codes.map((c) => (
          <View key={c} className="w-[48.5%] items-center rounded-lg border border-line bg-sand py-2.5">
            <Text selectable className="font-mono text-[15px] font-semibold tracking-widest text-fg">
              {c}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row gap-2">
        <SmallButton
          icon="copy"
          label={copied ? 'Copied' : 'Copy codes'}
          onPress={async () => {
            await Clipboard.setStringAsync(text);
            setCopied(true);
          }}
        />
        <SmallButton icon="share" label="Share" variant="outline" onPress={() => Share.share({ message: text }).catch(() => {})} />
      </View>
    </View>
  );
}

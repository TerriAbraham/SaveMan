import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';

const LENGTH = 6;

/**
 * Six boxes for an authenticator code. A transparent input sits on top, so typing, pasting
 * and the iOS / Android "one-time code" autofill all work.
 */
export function CodeField({
  value,
  onChangeText,
  onComplete,
  error,
  autoFocus,
}: {
  value: string;
  onChangeText: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  return (
    <View className="gap-1.5">
      <Text className="text-label text-fg">6-digit code</Text>
      <View>
        <View className="flex-row gap-2">
          {digits.map((d, i) => {
            const active = focused && i === Math.min(value.length, LENGTH - 1);
            const border = error ? 'border-red-dark' : active ? 'border-red' : 'border-line';
            return (
              <View key={i} className={`h-14 flex-1 items-center justify-center rounded-xl border-[1.5px] bg-surface ${border}`}>
                <Text className="text-title text-fg">{d}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          value={value}
          onChangeText={(text) => {
            const code = text.replace(/\D/g, '').slice(0, LENGTH);
            onChangeText(code);
            if (code.length === LENGTH) onComplete?.(code);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          caretHidden
          selectionColor={colors.surface}
          accessibilityLabel="6-digit code from your authenticator app"
          className="absolute inset-0 text-transparent web:outline-none"
        />
      </View>
      {!!error && <Text className="text-caption text-red-dark">{error}</Text>}
    </View>
  );
}

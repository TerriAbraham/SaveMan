import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors } from '@/constants/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'className'> {
  label: string;
  icon?: IconName;
  error?: string;
}

export function TextField({ label, icon, error, secureTextEntry, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? 'border-red-dark' : focused ? 'border-red' : 'border-line';

  return (
    <View className="gap-1.5">
      <Text className="text-label text-fg">{label}</Text>
      <View className={`min-h-[52px] flex-row items-center gap-2.5 rounded-xl border-[1.5px] bg-surface px-4 ${borderColor}`}>
        {icon && <Icon name={icon} size={18} color={focused ? colors.red : colors.textMuted} />}
        <TextInput
          {...inputProps}
          secureTextEntry={secureTextEntry && hidden}
          placeholderTextColor={colors.textMuted}
          className="flex-1 py-3 text-[16px] text-fg"
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {!!error && <Text className="text-caption text-red-dark">{error}</Text>}
    </View>
  );
}

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors, radius, spacing, type } from '@/constants/theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: IconName;
  error?: string;
}

export function TextField({ label, icon, error, secureTextEntry, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.focused, !!error && styles.errored]}>
        {icon && <Icon name={icon} size={18} color={focused ? colors.red : colors.textMuted} />}
        <TextInput
          {...inputProps}
          secureTextEntry={secureTextEntry && hidden}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
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
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs + 2 },
  label: { ...type.label, color: colors.text },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.red },
  errored: { borderColor: colors.redDark },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: spacing.md },
  error: { ...type.caption, color: colors.redDark },
});

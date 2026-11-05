import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.red, fg: colors.textOnDark, border: colors.red },
  secondary: { bg: colors.ink, fg: colors.textOnDark, border: colors.ink },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.red, border: 'transparent' },
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const v = variants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}>
      {loading ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.title, { color: v.fg }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  inactive: { opacity: 0.5 },
});

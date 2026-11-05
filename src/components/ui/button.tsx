import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

const variants: Record<Variant, { container: string; label: string; spinner: string }> = {
  primary: { container: 'bg-red border-red', label: 'text-on-dark', spinner: colors.textOnDark },
  secondary: { container: 'bg-ink border-ink', label: 'text-on-dark', spinner: colors.textOnDark },
  outline: { container: 'bg-transparent border-line', label: 'text-ink', spinner: colors.ink },
  ghost: { container: 'bg-transparent border-transparent', label: 'text-red', spinner: colors.red },
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
      className={`min-h-[52px] items-center justify-center rounded-xl border-[1.5px] px-6 active:scale-[0.99] active:opacity-85 ${v.container} ${inactive ? 'opacity-50' : ''}`}>
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <Text className={`text-[16px] font-bold ${v.label}`}>{title}</Text>
      )}
    </Pressable>
  );
}

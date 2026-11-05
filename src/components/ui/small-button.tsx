import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors } from '@/constants/theme';

type Variant = 'primary' | 'outline' | 'danger';

const variants: Record<Variant, { box: string; text: string; icon: string }> = {
  primary: { box: 'border-red bg-red', text: 'text-on-dark', icon: colors.textOnDark },
  outline: { box: 'border-line bg-surface', text: 'text-fg', icon: colors.ink },
  danger: { box: 'border-red-dark bg-surface', text: 'text-red-dark', icon: colors.redDark },
};

/** Compact button for use inside cards, where the full-size Button is too tall. */
export function SmallButton({
  label,
  icon,
  variant = 'primary',
  onPress,
}: {
  label: string;
  icon?: IconName;
  variant?: Variant;
  onPress: () => void;
}) {
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center justify-center gap-1.5 rounded-lg border-[1.5px] px-3 py-2.5 active:opacity-80 ${v.box}`}>
      {icon && <Icon name={icon} size={16} color={v.icon} />}
      <Text className={`text-label ${v.text}`}>{label}</Text>
    </Pressable>
  );
}

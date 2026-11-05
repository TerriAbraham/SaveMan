import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';

/** The one empty-list look used across the app: icon, title, explanation, optional action. */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-2 rounded-card border border-line bg-surface p-6">
      <View className="mb-1 h-12 w-12 items-center justify-center rounded-full bg-sand">
        <Icon name={icon} size={24} color={colors.textMuted} />
      </View>
      <Text className="text-center text-heading text-fg">{title}</Text>
      <Text className="text-center text-body text-fg-muted">{message}</Text>
      {actionLabel && onAction && (
        <View className="mt-2 self-stretch">
          <Button title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

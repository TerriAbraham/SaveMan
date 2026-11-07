import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

/** The server can't send email yet (no Brevo key), so it hands the code to the app instead. */
export function DevCodeNotice({ code }: { code: string }) {
  return (
    <View className="flex-row items-start gap-3 rounded-card bg-gold-tint p-4">
      <Icon name="key" size={20} color={colors.inkSoft} />
      <Text className="flex-1 text-body text-fg">
        Email isn’t set up on the SaveMan server yet, so the code is shown here instead: <Text className="font-bold tracking-[2px]">{code}</Text>
      </Text>
    </View>
  );
}

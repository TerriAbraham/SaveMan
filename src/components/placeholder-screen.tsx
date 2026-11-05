import { ScrollView, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors } from '@/constants/theme';

interface PlaceholderScreenProps {
  icon: IconName;
  title: string;
  phase: number;
  features: string[];
  greeting?: string;
}

/** Stand-in for screens that are built in a later phase. */
export function PlaceholderScreen({ icon, title, phase, features, greeting }: PlaceholderScreenProps) {
  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      {greeting && <Text className="text-title text-fg">{greeting}</Text>}
      <View className="items-center gap-3 rounded-card border border-line bg-surface p-6">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-red-tint">
          <Icon name={icon} size={28} color={colors.red} />
        </View>
        <Text className="text-heading text-fg">{title}</Text>
        <View className="rounded-full bg-gold-tint px-3 py-1">
          <Text className="text-label text-ink-soft">Coming in Phase {phase}</Text>
        </View>
        <View className="mt-2 gap-2 self-stretch">
          {features.map((f) => (
            <View key={f} className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-gold" />
              <Text className="flex-1 text-body text-fg-muted">{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

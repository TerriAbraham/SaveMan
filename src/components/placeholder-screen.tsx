import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors, radius, spacing, type } from '@/constants/theme';

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
    <ScrollView contentContainerStyle={styles.container}>
      {greeting && <Text style={styles.greeting}>{greeting}</Text>}
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={28} color={colors.red} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Coming in Phase {phase}</Text>
        </View>
        <View style={styles.list}>
          {features.map((f) => (
            <View key={f} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.feature}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  greeting: { ...type.title, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.redTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.heading, color: colors.text },
  pill: {
    backgroundColor: colors.goldTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  pillText: { ...type.label, color: colors.inkSoft },
  list: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  feature: { ...type.body, color: colors.textMuted, flex: 1 },
});

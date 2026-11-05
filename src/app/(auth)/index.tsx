import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark, PatternBand, Wordmark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors, radius, spacing, type } from '@/constants/theme';

const highlights: { icon: IconName; title: string; text: string }[] = [
  { icon: 'verified', title: 'Verified experts', text: 'Every consultant is checked by the SaveMan team.' },
  { icon: 'calendar', title: 'Book in minutes', text: 'In person, by phone or video, across all provinces.' },
  { icon: 'chat', title: 'Message directly', text: 'Ask questions before and after your session.' },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}>
        <View style={styles.brandRow}>
          <BrandMark size={56} />
          <Wordmark light />
        </View>
        <Text style={styles.headline}>Find trusted consultants across Papua New Guinea.</Text>
        <Text style={styles.lead}>From Port Moresby to the Highlands and the Islands, expert advice is a booking away.</Text>
      </View>
      <PatternBand />

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.highlights}>
          {highlights.map((h) => (
            <View key={h.title} style={styles.highlight}>
              <View style={styles.highlightIcon}>
                <Icon name={h.icon} size={20} color={colors.red} />
              </View>
              <View style={styles.highlightText}>
                <Text style={styles.highlightTitle}>{h.title}</Text>
                <Text style={styles.highlightBody}>{h.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Create an account" onPress={() => router.push('/sign-up')} />
          <Button title="Log in" variant="outline" onPress={() => router.push('/login')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sand },
  hero: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  headline: { ...type.display, color: colors.textOnDark },
  lead: { ...type.body, color: colors.textOnDarkMuted, lineHeight: 22 },
  body: { flex: 1, padding: spacing.xl, justifyContent: 'space-between', gap: spacing.xl },
  highlights: { gap: spacing.lg },
  highlight: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  highlightIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.redTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: { flex: 1 },
  highlightTitle: { ...type.heading, color: colors.text },
  highlightBody: { ...type.body, color: colors.textMuted },
  actions: { gap: spacing.md },
});

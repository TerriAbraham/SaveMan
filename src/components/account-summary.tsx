import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PatternBand } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { categories } from '@/data/categories';
import type { VerificationStatus } from '@/data/types';
import { initials } from '@/utils/format';

const roleLabels = { client: 'Client', consultant: 'Consultant', admin: 'Administrator' } as const;

const verificationStyles: Record<VerificationStatus, { label: string; bg: string; fg: string }> = {
  verified: { label: 'Verified', bg: colors.forestTint, fg: colors.forest },
  pending: { label: 'Awaiting verification', bg: colors.goldTint, fg: colors.inkSoft },
  rejected: { label: 'Verification rejected', bg: colors.redTint, fg: colors.redDark },
};

/** Phase 1 profile tab: who is signed in, plus sign out. */
export function AccountSummary() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const verification = user.role === 'consultant' ? verificationStyles[user.verification] : null;
  const city = user.role === 'client' ? user.city : user.role === 'consultant' ? user.location.city : null;
  const category = user.role === 'consultant' ? categories.find((c) => c.id === user.categoryId)?.name : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.role}>{roleLabels[user.role]}</Text>
          {verification && (
            <View style={[styles.badge, { backgroundColor: verification.bg }]}>
              <Icon
                name={user.role === 'consultant' && user.verification === 'verified' ? 'verified' : 'hourglass'}
                size={14}
                color={verification.fg}
              />
              <Text style={[styles.badgeText, { color: verification.fg }]}>{verification.label}</Text>
            </View>
          )}
        </View>
        <PatternBand height={8} count={40} />
        <View style={styles.details}>
          <Row icon="mail" text={user.email} />
          <Row icon="phone" text={user.phone} />
          {city && <Row icon="pin" text={city} />}
          {user.role === 'consultant' && <Row icon="briefcase" text={[user.title, category].filter(Boolean).join(' · ')} />}
        </View>
      </View>

      <Button title="Log out" variant="outline" onPress={signOut} />
    </ScrollView>
  );
}

function Row({ icon, text }: { icon: 'mail' | 'phone' | 'pin' | 'briefcase'; text: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hero: { alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.textOnDark, fontSize: 26, fontWeight: '800' },
  name: { ...type.title, color: colors.text },
  role: { ...type.body, color: colors.textMuted },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  badgeText: { ...type.label },
  details: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { ...type.body, color: colors.text, flex: 1 },
});

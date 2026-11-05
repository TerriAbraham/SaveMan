import { ScrollView, Text, View } from 'react-native';

import { PatternBand } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { categories } from '@/data/categories';
import type { VerificationStatus } from '@/data/types';
import { initials } from '@/utils/format';

const roleLabels = { client: 'Client', consultant: 'Consultant', admin: 'Administrator' } as const;

const verificationStyles: Record<VerificationStatus, { label: string; badge: string; text: string; icon: IconName; tint: string }> = {
  verified: { label: 'Verified', badge: 'bg-forest-tint', text: 'text-forest', icon: 'verified', tint: colors.forest },
  pending: { label: 'Awaiting verification', badge: 'bg-gold-tint', text: 'text-ink-soft', icon: 'hourglass', tint: colors.inkSoft },
  rejected: { label: 'Verification rejected', badge: 'bg-red-tint', text: 'text-red-dark', icon: 'hourglass', tint: colors.redDark },
};

/** Phase 1 profile tab: who is signed in, plus sign out. */
export function AccountSummary() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const verification = user.role === 'consultant' ? verificationStyles[user.verification] : null;
  const city = user.role === 'client' ? user.city : user.role === 'consultant' ? user.location.city : null;
  const category = user.role === 'consultant' ? categories.find((c) => c.id === user.categoryId)?.name : null;

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <View className="overflow-hidden rounded-card border border-line bg-surface">
        <View className="items-center gap-1 p-6">
          <View className="mb-2 h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-gold bg-ink">
            <Text className="text-[26px] font-extrabold text-on-dark">{initials(user.name)}</Text>
          </View>
          <Text className="text-title text-fg">{user.name}</Text>
          <Text className="text-body text-fg-muted">{roleLabels[user.role]}</Text>
          {verification && (
            <View className={`mt-2 flex-row items-center gap-1 rounded-full px-3 py-1 ${verification.badge}`}>
              <Icon name={verification.icon} size={14} color={verification.tint} />
              <Text className={`text-label ${verification.text}`}>{verification.label}</Text>
            </View>
          )}
        </View>
        <PatternBand height={8} count={40} />
        <View className="gap-3 p-4">
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

function Row({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Text className="flex-1 text-body text-fg">{text}</Text>
    </View>
  );
}

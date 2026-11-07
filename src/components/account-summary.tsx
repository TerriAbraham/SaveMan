import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { HeroTexture, PatternBand } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { VerificationStatus } from '@/data/types';

const roleLabels = { client: 'Client', consultant: 'Consultant', admin: 'Administrator' } as const;

const verificationStyles: Record<VerificationStatus, { label: string; badge: string; text: string; icon: IconName; tint: string }> = {
  verified: { label: 'Verified', badge: 'bg-forest-tint', text: 'text-forest', icon: 'verified', tint: colors.forest },
  pending: { label: 'Awaiting verification', badge: 'bg-gold-tint', text: 'text-ink-soft', icon: 'hourglass', tint: colors.inkSoft },
  rejected: { label: 'Verification rejected', badge: 'bg-red-tint', text: 'text-red-dark', icon: 'hourglass', tint: colors.redDark },
};

/** Profile tab: who is signed in, any role-specific sections (`children`), then sign out. */
export function AccountSummary({ children }: { children?: ReactNode }) {
  const { categories } = useData();
  const router = useRouter();
  const { user, security, signOut } = useAuth();
  if (!user) return null;

  const verification = user.role === 'consultant' ? verificationStyles[user.verification] : null;
  const city = user.role === 'client' ? user.city : user.role === 'consultant' ? user.location.city : null;
  const category = user.role === 'consultant' ? categories.find((c) => c.id === user.categoryId)?.name : null;

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <View className="overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
        <View className="items-center gap-1 overflow-hidden p-6">
          <HeroTexture />
          <Avatar name={user.name} uri={user.avatarUri} size="lg" />
          <Text className="mt-2 text-title text-on-dark">{user.name}</Text>
          <Text className="text-body text-on-dark-muted">{roleLabels[user.role]}</Text>
          {verification && (
            <View className={`mt-2 flex-row items-center gap-1 rounded-full px-3 py-1 ${verification.badge}`}>
              <Icon name={verification.icon} size={14} color={verification.tint} />
              <Text className={`text-label ${verification.text}`}>{verification.label}</Text>
            </View>
          )}
        </View>
        <PatternBand size="sm" />
        <View className="gap-3 p-4">
          <Row icon="mail" text={user.email} />
          <Row icon="phone" text={user.phone} />
          {city && <Row icon="pin" text={city} />}
          {user.role === 'consultant' && <Row icon="briefcase" text={[user.title, category].filter(Boolean).join(' · ')} />}
        </View>
      </View>

      {children}

      <Pressable
        onPress={() => router.push(user.role === 'consultant' ? '/consultant/security' : '/client/security')}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card active:opacity-80">
        <Icon name="shield" size={20} color={security?.mfaEnabled ? colors.forest : colors.textMuted} />
        <View className="flex-1">
          <Text className="text-heading text-fg">Security</Text>
          <Text className="text-caption text-fg-muted">Two-step verification {security?.mfaEnabled ? 'on' : 'off'}</Text>
        </View>
        <Icon name="chevronRight" size={16} color={colors.textMuted} />
      </Pressable>

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

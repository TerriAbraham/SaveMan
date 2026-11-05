import { Text, View } from 'react-native';

import type { User } from '@/data/types';

const roleLabel = { client: 'Client', consultant: 'Consultant', admin: 'Admin' } as const;

/** Role, verification and account-status pills for admin lists. */
export function UserBadges({ user }: { user: User }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      <Pill label={roleLabel[user.role]} className="bg-sand" textClass="text-fg-muted" />
      {user.role === 'consultant' && user.verification === 'verified' && (
        <Pill label="Verified" className="bg-forest-tint" textClass="text-forest" />
      )}
      {user.role === 'consultant' && user.verification === 'pending' && (
        <Pill label="Awaiting verification" className="bg-gold-tint" textClass="text-ink-soft" />
      )}
      {user.role === 'consultant' && user.verification === 'rejected' && (
        <Pill label="Rejected" className="bg-red-tint" textClass="text-red-dark" />
      )}
      {user.status === 'suspended' && <Pill label="Suspended" className="bg-red" textClass="text-on-dark" />}
    </View>
  );
}

function Pill({ label, className, textClass }: { label: string; className: string; textClass: string }) {
  return (
    <View className={`rounded-full px-2.5 py-0.5 ${className}`}>
      <Text className={`text-caption font-semibold ${textClass}`}>{label}</Text>
    </View>
  );
}

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { QualificationList } from '@/components/qualification-list';
import { SmallButton } from '@/components/ui/small-button';
import { UserBadges } from '@/components/user-badges';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Consultant } from '@/data/types';
import { useAdminActions } from '@/hooks/use-admin-actions';
import { formatDate, formatKina } from '@/utils/format';

export default function VerificationQueueScreen() {
  const { users } = useAuth();
  const consultants = users.filter((u): u is Consultant => u.role === 'consultant');
  // Oldest application first, so nobody waits too long.
  const pending = consultants.filter((c) => c.verification === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const rejected = consultants.filter((c) => c.verification === 'rejected');

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
      <Text className="text-body text-fg-muted">
        Check each applicant&apos;s details before approving. Only verified consultants appear in search and on the map.
      </Text>

      <Text className="text-heading text-fg">Waiting for review ({pending.length})</Text>
      {pending.length === 0 ? (
        <View className="items-center gap-2 rounded-card border border-line/70 bg-surface shadow-card p-6">
          <Icon name="check" size={28} color={colors.forest} />
          <Text className="text-body text-fg-muted">All caught up. No applications waiting.</Text>
        </View>
      ) : (
        pending.map((c) => <ApplicantCard key={c.id} consultant={c} />)
      )}

      {rejected.length > 0 && (
        <>
          <Text className="mt-2 text-heading text-fg">Rejected ({rejected.length})</Text>
          {rejected.map((c) => (
            <ApplicantCard key={c.id} consultant={c} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function ApplicantCard({ consultant: c }: { consultant: Consultant }) {
  const { categories } = useData();
  const router = useRouter();
  const actions = useAdminActions();
  const category = categories.find((cat) => cat.id === c.categoryId)?.name ?? 'No category';

  return (
    <View className="gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4">
      <Pressable
        onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: c.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Open ${c.name}`}
        className="flex-row items-center gap-3 active:opacity-70">
        <Avatar name={c.name} uri={c.avatarUri} />
        <View className="flex-1 gap-1">
          <Text className="text-heading text-fg">{c.name}</Text>
          <Text className="text-body text-fg-muted" numberOfLines={1}>
            {c.title || 'No title yet'}
          </Text>
          <UserBadges user={c} />
        </View>
        <Icon name="chevronRight" size={18} color={colors.textMuted} />
      </Pressable>

      <View className="gap-1 rounded-xl bg-sand p-3">
        <Text className="text-caption text-fg-muted">
          {category} · {c.location.city} · applied {formatDate(c.createdAt)}
        </Text>
        <Text className="text-caption text-fg-muted">
          {c.services.length} service{c.services.length === 1 ? '' : 's'} · {c.yearsExperience} yrs experience ·{' '}
          {c.hourlyRate ? `${formatKina(c.hourlyRate)}/hr` : 'no rate set'}
        </Text>
        <Text className="text-body text-fg" numberOfLines={3}>
          {c.bio || 'No bio provided.'}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-label text-fg">Qualifications & licences</Text>
        {c.qualifications.length === 0 ? (
          <Text className="text-caption text-red-dark">None listed. Ask the applicant for proof before approving.</Text>
        ) : (
          <QualificationList qualifications={c.qualifications} />
        )}
      </View>

      <View className="flex-row gap-2">
        {c.verification === 'pending' && (
          <View className="flex-1">
            <SmallButton label="Reject" variant="danger" onPress={() => actions.reject(c)} />
          </View>
        )}
        <View className="flex-1">
          <SmallButton label="Approve" icon="verified" onPress={() => actions.approve(c)} />
        </View>
      </View>
    </View>
  );
}

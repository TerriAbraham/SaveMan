import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { errorMessage } from '@/api/auth-api';
import { dataApi } from '@/api/data-api';
import { Avatar } from '@/components/avatar';
import { BookingStatusPill } from '@/components/booking-status';
import { Icon, type IconName } from '@/components/icon';
import { QualificationList } from '@/components/qualification-list';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { UserBadges } from '@/components/user-badges';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Client, Consultant } from '@/data/types';
import { useAdminActions } from '@/hooks/use-admin-actions';
import { hasStarted } from '@/utils/booking-rules';
import { formatTime } from '@/utils/dates';
import { formatDate, formatKina } from '@/utils/format';

export default function AdminUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { users } = useAuth();
  const { bookings, categories } = useData();
  const actions = useAdminActions();

  // Admin accounts aren't managed from here.
  const user = users.find((u): u is Client | Consultant => u.id === id && u.role !== 'admin');
  if (!user) {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="User" fallbackHref="/admin/users" />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-body text-fg-muted">This user could not be found.</Text>
        </View>
      </View>
    );
  }

  const theirs = bookings
    .filter((b) => b.clientId === user.id || b.consultantId === user.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const otherName = (personId: string) => users.find((u) => u.id === personId)?.name ?? 'Unknown';
  const suspended = user.status === 'suspended';

  return (
    <View className="flex-1 bg-sand">
      <ScreenHeader title={user.name} subtitle={user.role === 'client' ? 'Client account' : 'Consultant account'} fallbackHref="/admin/users" />
      <ScrollView contentContainerClassName="gap-4 px-4 pt-4 pb-safe-offset-6">
        <Card>
          <View className="flex-row items-center gap-3">
            <Avatar name={user.name} uri={user.avatarUri} />
            <View className="flex-1 gap-1">
              <Text className="text-heading text-fg">{user.name}</Text>
              <UserBadges user={user} />
            </View>
          </View>
          <Row icon="mail" text={user.email} />
          <Row icon="phone" text={user.phone} />
          <Row icon="pin" text={user.role === 'client' ? user.city : `${user.location.address || 'No address'}, ${user.location.city}`} />
          <Row icon="calendar" text={`Joined ${formatDate(user.createdAt)}`} />
        </Card>

        {user.role === 'consultant' && (
          <Card title="Verification">
            <Text className="text-body text-fg-muted">
              {user.verification === 'verified'
                ? 'Verified. This consultant appears in search and on the map.'
                : user.verification === 'pending'
                  ? 'Waiting for review. Hidden from clients until approved.'
                  : 'Rejected. Hidden from clients.'}
            </Text>
            <Row icon="briefcase" text={`${user.title || 'No title'} · ${categories.find((c) => c.id === user.categoryId)?.name ?? 'No category'}`} />
            <Row
              icon="award"
              text={`${user.yearsExperience} yrs experience · ${user.services.length} services · ${user.hourlyRate ? `${formatKina(user.hourlyRate)}/hr` : 'no rate'}`}
            />
            {user.reviewCount > 0 && <Row icon="star" text={`${user.rating.toFixed(1)} from ${user.reviewCount} reviews`} />}
            {user.bio !== '' && <Text className="text-body text-fg">{user.bio}</Text>}
            <View className="gap-2 border-t border-line pt-3">
              <Text className="text-label text-fg">Qualifications & licences</Text>
              <QualificationList qualifications={user.qualifications} emptyText="None listed." />
            </View>
            {user.verification !== 'verified' && <Button title="Approve consultant" onPress={() => actions.approve(user)} />}
            {user.verification !== 'rejected' && (
              <Button
                title={user.verification === 'verified' ? 'Revoke verification' : 'Reject application'}
                variant="ghost"
                onPress={() => actions.reject(user)}
              />
            )}
          </Card>
        )}

        <Card title="Account">
          <Text className="text-body text-fg-muted">
            {suspended
              ? 'Suspended. This person can’t log in' + (user.role === 'consultant' ? ' and is hidden from clients.' : '.')
              : 'Active. This person can log in and use SaveMan.'}
          </Text>
          {suspended ? (
            <Button title="Reactivate account" variant="secondary" onPress={() => actions.reactivate(user)} />
          ) : (
            <Button title="Suspend account" variant="outline" onPress={() => actions.suspend(user)} />
          )}
        </Card>

        <ResetCodeCard user={user} />

        <Card title={`Bookings (${theirs.length})`}>
          {theirs.length === 0 ? (
            <Text className="text-body text-fg-muted">No bookings yet.</Text>
          ) : (
            theirs.slice(0, 10).map((b, i) => (
              <View key={b.id} className={`gap-1 ${i > 0 ? 'border-t border-line pt-3' : ''}`}>
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-label text-fg">{b.serviceName}</Text>
                  <Text className="text-label text-fg">{formatKina(b.price)}</Text>
                </View>
                <Text className="text-caption text-fg-muted">
                  {user.role === 'client' ? `with ${otherName(b.consultantId)}` : `for ${otherName(b.clientId)}`} ·{' '}
                  {formatDate(b.date)} {formatTime(b.time)}
                </Text>
                <BookingStatusPill status={b.status} started={hasStarted(b)} />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

/** A one-time code for someone who forgot their password, to give them by phone or in person. */
function ResetCodeCard({ user }: { user: Client | Consultant }) {
  const { token } = useAuth();
  const [reset, setReset] = useState<{ code: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      setReset(await dataApi.users.createResetCode(token, user.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const until = reset && new Date(reset.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <Card title="Password">
      <Text className="text-body text-fg-muted">
        Forgot their password? Make a reset code and give it to {user.name} by phone or in person, after checking it’s really them. They
        enter it on the login screen under “Forgot password?”.
      </Text>
      {reset && (
        <View className="items-center gap-1 rounded-xl bg-sand p-4">
          <Text selectable className="font-mono text-[26px] font-bold tracking-[3px] text-fg">
            {reset.code}
          </Text>
          <Text className="text-caption text-fg-muted">Works once, until {until}. Making a new code cancels this one.</Text>
        </View>
      )}
      {error && <Text className="text-caption text-red-dark">{error}</Text>}
      <Button title={reset ? 'Make a new code' : 'Create reset code'} variant="outline" onPress={create} loading={busy} />
    </Card>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4">
      {title && <Text className="text-heading text-fg">{title}</Text>}
      {children}
    </View>
  );
}

function Row({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text className="flex-1 text-body text-fg">{text}</Text>
    </View>
  );
}

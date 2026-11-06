import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { bookingStatusMeta } from '@/components/booking-status';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { BookingStatus } from '@/data/types';
import { computeStats } from '@/utils/admin-stats';
import { formatKina } from '@/utils/format';

const STATUS_ORDER: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'declined'];

export default function AdminOverviewScreen() {
  const router = useRouter();
  const { user, users, signOut } = useAuth();
  const { bookings, reviews } = useData();
  const stats = computeStats(users, bookings, reviews);

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
      <Text className="text-title text-fg">Platform at a glance</Text>

      <View className="flex-row flex-wrap gap-2">
        <Tile icon="people" label="Users" value={stats.users} detail={`${stats.clients} clients`} />
        <Tile
          icon="briefcase"
          label="Consultants"
          value={stats.consultants}
          detail={`${stats.verifiedConsultants} verified`}
        />
        <Tile icon="list" label="Bookings" value={stats.bookings} detail={`${formatKina(stats.completedValue)} completed`} />
        <Tile icon="star" label="Reviews" value={stats.reviews} detail={`${stats.removedReviews} removed`} />
      </View>

      <Text className="mt-2 text-heading text-fg">Manage</Text>
      <AttentionRow
        icon="verified"
        text={
          stats.pendingVerification === 0
            ? 'No consultants waiting for verification'
            : `${stats.pendingVerification} consultant${stats.pendingVerification > 1 ? 's' : ''} waiting for verification`
        }
        urgent={stats.pendingVerification > 0}
        href="/admin/verify"
      />
      <AttentionRow
        icon="lock"
        text={`${stats.suspended} suspended account${stats.suspended === 1 ? '' : 's'}`}
        href="/admin/users"
      />
      <AttentionRow icon="star" text="Check recent reviews" href="/admin/reviews" />
      <AttentionRow icon="briefcase" text="Manage service categories" href="/admin/categories" />
      <AttentionRow icon="shield" text="Security and two-step verification" href="/admin/security" />

      <Text className="mt-2 text-heading text-fg">Bookings by status</Text>
      <View className="gap-2.5 rounded-card border border-line/70 bg-surface shadow-card p-4">
        {STATUS_ORDER.map((s) => {
          const count = stats.bookingsByStatus[s];
          const share = stats.bookings ? count / stats.bookings : 0;
          return (
            <View key={s} className="gap-1">
              <View className="flex-row justify-between">
                <Text className="text-label font-normal text-fg">{bookingStatusMeta[s].label}</Text>
                <Text className="text-label text-fg">{count}</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-sand">
                {/* Bar width is data, so it stays in style. */}
                <View className="h-2 rounded-full bg-red" style={{ width: `${Math.round(share * 100)}%` }} />
              </View>
            </View>
          );
        })}
        <Pressable onPress={() => router.navigate('/admin/bookings')} className="mt-1 self-start active:opacity-70">
          <Text className="text-label text-red">View all bookings</Text>
        </Pressable>
      </View>

      <View className="mt-2 gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4">
        <Text className="text-label text-fg-muted">Signed in as {user?.email}</Text>
        <Button title="Log out" variant="outline" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

function Tile({ icon, label, value, detail }: { icon: IconName; label: string; value: number; detail: string }) {
  return (
    <View className="w-[48.5%] gap-1 rounded-card border border-line/70 bg-surface shadow-card p-4">
      <View className="flex-row items-center gap-1.5">
        <Icon name={icon} size={16} color={colors.red} />
        <Text className="text-label text-fg-muted">{label}</Text>
      </View>
      <Text className="text-display text-fg">{value}</Text>
      <Text className="text-caption text-fg-muted">{detail}</Text>
    </View>
  );
}

function AttentionRow({ icon, text, href, urgent }: { icon: IconName; text: string; href: Href; urgent?: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 rounded-xl border p-3.5 active:opacity-80 ${urgent ? 'border-gold bg-gold-tint' : 'border-line bg-surface'}`}>
      <Icon name={icon} size={20} color={urgent ? colors.inkSoft : colors.textMuted} />
      <Text className={`flex-1 text-body ${urgent ? 'font-semibold text-fg' : 'text-fg'}`}>{text}</Text>
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

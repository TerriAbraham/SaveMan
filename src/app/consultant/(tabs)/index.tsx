import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BookingCard } from '@/components/booking-card';
import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Booking, Consultant } from '@/data/types';
import { useBookingActions } from '@/hooks/use-booking-actions';
import { canAccept, canComplete, hasStarted } from '@/utils/booking-rules';
import { formatKina } from '@/utils/format';

const byStart = (a: Booking, b: Booking) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

export default function ConsultantDashboardScreen() {
  const { user } = useAuth();
  if (user?.role !== 'consultant') return null;
  return <Dashboard consultant={user} />;
}

function Dashboard({ consultant }: { consultant: Consultant }) {
  const router = useRouter();
  const { users } = useAuth();
  const { bookings } = useData();
  const actions = useBookingActions();

  const mine = bookings.filter((b) => b.consultantId === consultant.id);
  const toComplete = mine.filter((b) => canComplete(b)).sort(byStart);
  const requests = mine.filter((b) => b.status === 'pending').sort(byStart);
  const upcoming = mine.filter((b) => b.status === 'confirmed' && !hasStarted(b)).sort(byStart);
  const history = mine
    .filter((b) => ['completed', 'declined', 'cancelled'].includes(b.status))
    .sort((a, b) => byStart(b, a))
    .slice(0, 5);
  const earned = mine.filter((b) => b.status === 'completed').reduce((sum, b) => sum + b.price, 0);

  const clientName = (b: Booking) => users.find((u) => u.id === b.clientId)?.name ?? 'Client';
  const open = (b: Booking) => router.push({ pathname: '/consultant/booking/[id]', params: { id: b.id } });

  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
      <Text className="text-title text-fg">Welcome, {consultant.name}</Text>

      {consultant.verification !== 'verified' && (
        <View
          className={`flex-row items-start gap-3 rounded-card p-4 ${consultant.verification === 'pending' ? 'bg-gold-tint' : 'bg-red-tint'}`}>
          <Icon name="hourglass" size={20} color={consultant.verification === 'pending' ? colors.inkSoft : colors.redDark} />
          <Text className="flex-1 text-body text-fg">
            {consultant.verification === 'pending'
              ? 'Your profile is waiting for verification. Clients can book you once the SaveMan team approves it.'
              : 'Your verification was not approved. Contact SaveMan support to find out what to update.'}
          </Text>
        </View>
      )}

      <View className="flex-row gap-2">
        <Stat label="Requests" value={String(requests.length)} highlight={requests.length > 0} />
        <Stat label="Upcoming" value={String(upcoming.length)} />
        <Stat label="Earned" value={formatKina(earned)} />
        <Stat label="Rating" value={consultant.reviewCount ? consultant.rating.toFixed(1) : 'New'} />
      </View>

      {toComplete.length > 0 && (
        <Section title="Ready to complete" hint="These sessions have started. Mark them done so clients can review.">
          {toComplete.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              personName={clientName(b)}
              onPress={() => open(b)}
              footer={<ActionButton label="Mark completed" icon="check" onPress={() => actions.complete(b)} />}
            />
          ))}
        </Section>
      )}

      <Section title="New requests" empty="No new requests right now.">
        {requests.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            personName={clientName(b)}
            onPress={() => open(b)}
            footer={
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <ActionButton label="Decline" variant="outline" onPress={() => actions.decline(b, clientName(b))} />
                </View>
                <View className="flex-1">
                  {canAccept(b) ? (
                    <ActionButton label="Accept" icon="check" onPress={() => actions.accept(b)} />
                  ) : (
                    <Text className="py-2.5 text-center text-caption text-fg-muted">Start time has passed</Text>
                  )}
                </View>
              </View>
            }
          />
        ))}
      </Section>

      <Section title="Upcoming sessions" empty="No confirmed sessions coming up.">
        {upcoming.map((b) => (
          <BookingCard key={b.id} booking={b} personName={clientName(b)} onPress={() => open(b)} />
        ))}
      </Section>

      {history.length > 0 && (
        <Section title="Recent history">
          {history.map((b) => (
            <BookingCard key={b.id} booking={b} personName={clientName(b)} onPress={() => open(b)} />
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className={`flex-1 items-center gap-0.5 rounded-xl border py-3 ${highlight ? 'border-red bg-red-tint' : 'border-line bg-surface'}`}>
      <Text className={`text-heading ${highlight ? 'text-red' : 'text-fg'}`} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="text-caption text-fg-muted">{label}</Text>
    </View>
  );
}

function Section({ title, hint, empty, children }: { title: string; hint?: string; empty?: string; children: ReactNode[] }) {
  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className="text-heading text-fg">
          {title} {children.length > 0 && <Text className="text-fg-muted">({children.length})</Text>}
        </Text>
        {hint && <Text className="text-caption text-fg-muted">{hint}</Text>}
      </View>
      {children.length > 0 ? (
        children
      ) : (
        <Text className="rounded-xl border border-dashed border-line p-4 text-center text-body text-fg-muted">{empty}</Text>
      )}
    </View>
  );
}

/** Compact button for use inside a card (the full-size Button is too tall here). */
function ActionButton({
  label,
  icon,
  variant = 'primary',
  onPress,
}: {
  label: string;
  icon?: 'check';
  variant?: 'primary' | 'outline';
  onPress: () => void;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center justify-center gap-1.5 rounded-lg border-[1.5px] py-2.5 active:opacity-80 ${
        primary ? 'border-red bg-red' : 'border-line bg-surface'
      }`}>
      {icon && <Icon name={icon} size={16} color={primary ? colors.textOnDark : colors.ink} />}
      <Text className={`text-label ${primary ? 'text-on-dark' : 'text-fg'}`}>{label}</Text>
    </Pressable>
  );
}

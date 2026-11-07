import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { HeroTexture, PatternBand } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { LocationCard } from '@/components/location-card';
import { QualificationList } from '@/components/qualification-list';
import { RatingSummary, Stars } from '@/components/rating';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/verified-badge';
import { colors } from '@/constants/theme';
import { useData } from '@/context/data-context';
import { useConsultantReviews, usePublicConsultant } from '@/hooks/use-directory';
import { formatDate, formatDuration, formatKina } from '@/utils/format';
import { callPhone } from '@/utils/phone';

export default function ConsultantProfileScreen() {
  const { categories } = useData();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const consultant = usePublicConsultant(id);

  if (!consultant) {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Consultant" fallbackHref="/client" />
        <View className="flex-1 items-center justify-center gap-2 p-6">
          <Icon name="person" size={32} color={colors.textMuted} />
          <Text className="text-heading text-fg">Consultant not available</Text>
          <Text className="text-center text-body text-fg-muted">
            This profile may have been removed or is waiting for verification.
          </Text>
        </View>
      </View>
    );
  }

  const c = consultant;
  const category = categories.find((cat) => cat.id === c.categoryId)?.name ?? '';
  const startingPrice = Math.min(...c.services.map((s) => s.price), c.hourlyRate);

  return (
    <View className="flex-1 bg-sand">
      {/* Leave room for the sticky bar (about 110px tall) plus the system navigation bar under it. */}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View className="overflow-hidden px-6 pb-6">
          <HeroTexture />
          <TopBar />
          <View className="items-center gap-1.5">
            <Avatar name={c.name} uri={c.avatarUri} size="lg" />
            <Text className="mt-2 text-center text-title text-on-dark">{c.name}</Text>
            <Text className="text-center text-body text-on-dark-muted">{c.title}</Text>
            <View className="mt-1 flex-row items-center gap-1">
              <Icon name="pin" size={14} color={colors.gold} />
              <Text className="text-label font-normal text-on-dark-muted">
                {c.location.city}, {c.location.province}
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row rounded-2xl border border-white/10 bg-white/10 py-3">
            <Stat label="Rating">
              <RatingSummary rating={c.rating} count={c.reviewCount} light />
            </Stat>
            <Stat label="Experience">
              <Text className="text-label text-on-dark">{c.yearsExperience} yrs</Text>
            </Stat>
            <Stat label="Hourly rate" last>
              <Text className="text-label text-on-dark">{formatKina(c.hourlyRate)}</Text>
            </Stat>
          </View>
        </View>
        <PatternBand size="md" />

        <View className="gap-4 p-4">
          <Section title="About">
            <VerifiedBadge />
            <Text className="text-body leading-[22px] text-fg">{c.bio}</Text>
            <View className="mt-1 gap-2">
              <InfoRow icon="briefcase" text={category} />
              <InfoRow icon="globe" text={c.languages.join(', ')} />
              <InfoRow icon="award" text={`${c.yearsExperience} years of experience`} />
            </View>
          </Section>

          <Section title="Qualifications & licences">
            <QualificationList qualifications={c.qualifications} />
          </Section>

          <Section title="Services">
            {c.services.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => router.push({ pathname: '/client/book/[id]', params: { id: c.id, service: s.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Book ${s.name}, ${formatKina(s.price)}`}
                className={`gap-1 active:opacity-70 ${i > 0 ? 'border-t border-line pt-3' : ''}`}>
                <View className="flex-row items-start justify-between gap-3">
                  <Text className="flex-1 text-[15px] font-bold text-fg">{s.name}</Text>
                  <Text className="text-[15px] font-bold text-red">{formatKina(s.price)}</Text>
                </View>
                <Text className="text-body text-fg-muted">{s.description}</Text>
                <View className="flex-row items-center gap-1">
                  <Icon name="clock" size={13} color={colors.textMuted} />
                  <Text className="flex-1 text-caption text-fg-muted">{formatDuration(s.durationMins)}</Text>
                  <Text className="text-label text-red">Book</Text>
                  <Icon name="chevronRight" size={14} color={colors.red} />
                </View>
              </Pressable>
            ))}
          </Section>

          <Section title="Expertise">
            <View className="flex-row flex-wrap gap-2">
              {c.expertise.map((e) => (
                <View key={e} className="rounded-full bg-sand px-3 py-1.5">
                  <Text className="text-label font-normal text-fg">{e}</Text>
                </View>
              ))}
            </View>
          </Section>

          <LocationCard location={c.location} name={c.name} />

          <ReviewsSection consultantId={c.id} rating={c.rating} reviewCount={c.reviewCount} />
        </View>
      </ScrollView>

      {/* Sticky booking bar */}
      <View
        className="absolute bottom-0 left-0 right-0 flex-row items-center gap-3 border-t border-line bg-surface px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <View>
          <Text className="text-caption text-fg-muted">Sessions from</Text>
          <Text className="text-title text-fg">{formatKina(startingPrice)}</Text>
        </View>
        <Pressable
          onPress={() => callPhone(c.name, c.phone)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${c.name}`}
          className="h-[52px] w-[52px] items-center justify-center rounded-xl border-[1.5px] border-line active:opacity-70">
          <Icon name="phone" size={22} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/client/chat/[id]', params: { id: c.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Message ${c.name}`}
          className="h-[52px] w-[52px] items-center justify-center rounded-xl border-[1.5px] border-line active:opacity-70">
          <Icon name="chat" size={22} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Button
            title="Book now"
            onPress={() => router.push({ pathname: '/client/book/[id]', params: { id: c.id } })}
          />
        </View>
      </View>
    </View>
  );
}

function TopBar() {
  const router = useRouter();
  return (
    <View className="mb-4 flex-row pt-safe-offset-2">
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/client'))}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10">
        <Icon name="back" size={20} color={colors.textOnDark} />
      </Pressable>
    </View>
  );
}

function Stat({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <View className={`flex-1 items-center gap-1 ${last ? '' : 'border-r border-white/10'}`}>
      {children}
      <Text className="text-caption text-on-dark-muted">{label}</Text>
    </View>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-heading text-fg">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text className="flex-1 text-body text-fg">{text}</Text>
    </View>
  );
}

function ReviewsSection({ consultantId, rating, reviewCount }: { consultantId: string; rating: number; reviewCount: number }) {
  const reviews = useConsultantReviews(consultantId);

  return (
    <Section title="Reviews" right={<RatingSummary rating={rating} count={reviewCount} />}>
      {reviews.length === 0 ? (
        <Text className="text-body text-fg-muted">No reviews yet. Be the first to book a session.</Text>
      ) : (
        reviews.map((r, i) => (
          <View key={r.id} className={`gap-1.5 ${i > 0 ? 'border-t border-line pt-3' : ''}`}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Avatar name={r.reviewerName} uri={r.reviewerAvatar} size="sm" />
                <View>
                  <Text className="text-label text-fg">{r.reviewerName}</Text>
                  <Text className="text-caption text-fg-muted">{formatDate(r.createdAt)}</Text>
                </View>
              </View>
              <Stars rating={r.rating} />
            </View>
            <Text className="text-body leading-[21px] text-fg">{r.comment}</Text>
          </View>
        ))
      )}
      {reviews.length > 0 && reviewCount > reviews.length && (
        <Text className="text-caption text-fg-muted">
          Showing {reviews.length} most recent of {reviewCount} reviews
        </Text>
      )}
    </Section>
  );
}

import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandMark, HeroTexture, PatternBand, Wordmark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { RatingSummary, Stars } from '@/components/rating';
import { Button } from '@/components/ui/button';
import { VerifiedBadge } from '@/components/verified-badge';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Consultant } from '@/data/types';
import { usePublicConsultants } from '@/hooks/use-directory';
import { categoryIcon } from '@/utils/categories';
import { formatKina } from '@/utils/format';

const steps: { icon: IconName; title: string; text: string }[] = [
  { icon: 'search', title: 'Find the right expert', text: 'Search by service, town or name. Compare qualifications, prices and reviews.' },
  { icon: 'calendar', title: 'Book a time that suits you', text: 'Pick a service and a free slot. Meet in person, by phone or on a video call.' },
  { icon: 'chat', title: 'Get advice, then review', text: 'Message your consultant before and after the session, and rate them when it’s done.' },
];

const trust: { icon: IconName; title: string; text: string; tint: string; color: string }[] = [
  { icon: 'verified', title: 'Verified experts', text: 'Qualifications and licences are checked before a consultant appears.', tint: 'bg-forest-tint', color: colors.forest },
  { icon: 'shield', title: 'Secure accounts', text: 'Two-step verification protects consultant and admin accounts.', tint: 'bg-red-tint', color: colors.red },
  { icon: 'star', title: 'Honest reviews', text: 'Only clients who completed a session can leave a review.', tint: 'bg-gold-tint', color: colors.goldDark },
  { icon: 'money', title: 'Clear prices', text: 'Every service shows its price in Kina before you book.', tint: 'bg-sand', color: colors.ink },
];

const faqs: { q: string; a: string }[] = [
  {
    q: 'How much does a session cost?',
    a: 'Each consultant sets their own prices, shown in Kina on their profile for every service. You see the price before you book, and there’s no fee to join SaveMan.',
  },
  {
    q: 'How are consultants verified?',
    a: 'Consultants add their degrees, certificates and licence numbers. The SaveMan team checks them before the profile is shown to clients, and can remove anyone who breaks the rules.',
  },
  {
    q: 'Can I meet by phone or video?',
    a: 'Yes. When you book, choose in person, phone call or video call. Many consultants work with clients in every province.',
  },
  {
    q: 'I’m a consultant. How do I join?',
    a: 'Tap “Apply as a consultant”, add your title, area of expertise and qualifications, and set up two-step verification. Clients can book you once you’re verified.',
  },
];

/** Public home page: what SaveMan is, what's on offer, and how to get started. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { users } = useAuth();
  const { categories, reviews } = useData();
  const consultants = usePublicConsultants();

  const reviewCount = consultants.reduce((n, c) => n + c.reviewCount, 0);
  const avgRating = reviewCount ? consultants.reduce((n, c) => n + c.rating * c.reviewCount, 0) / reviewCount : 0;
  const towns = [...new Set(consultants.map((c) => c.location.city))];
  const topRated = [...consultants].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 5);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  // The longest five-star review makes the most useful example.
  const featured = reviews
    .filter((r) => !r.removedAt && r.rating === 5 && r.comment.trim().length > 0)
    .sort((a, b) => b.comment.length - a.comment.length)[0];
  const featuredClient = featured && users.find((u) => u.id === featured.clientId);
  const featuredConsultant = featured && consultants.find((c) => c.id === featured.consultantId);

  const signUp = () => router.push('/sign-up');
  const logIn = () => router.push('/login');

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} className="flex-1 bg-sand">
      {/* Hero */}
      <View className="gap-4 overflow-hidden px-6 pb-8 pt-safe-offset-5">
        <HeroTexture />
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <BrandMark />
            <Wordmark light />
          </View>
          <Pressable
            onPress={logIn}
            hitSlop={8}
            accessibilityRole="button"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 active:opacity-80">
            <Text className="text-label text-on-dark">Log in</Text>
          </Pressable>
        </View>
        <Text className="text-label uppercase tracking-[2px] text-gold">“Saveman” · Tok Pisin for an expert</Text>
        <Text className="text-display text-on-dark">Find trusted consultants across Papua New Guinea.</Text>
        <Text className="text-body leading-[22px] text-on-dark-muted">
          Business, finance, legal, IT, agriculture, HR and health advice from verified local experts. From Port Moresby to the
          Highlands and the Islands, help is a booking away.
        </Text>
        <View className="mt-2 flex-row gap-2">
          <Stat value={String(consultants.length)} label="Verified consultants" />
          <Stat value={String(categories.length)} label="Service areas" />
          <Stat value={avgRating ? avgRating.toFixed(1) : 'New'} label={`Average from ${reviewCount} reviews`} star />
        </View>
      </View>
      <PatternBand />

      <View className="gap-8 px-5 pt-6">
        <View className="gap-3">
          <Button title="Find a consultant" onPress={signUp} />
          <Text className="text-center text-caption text-fg-muted">Free to join. Create an account to search, book and message.</Text>
        </View>

        {/* Categories */}
        <Section title="What do you need help with?" subtitle="Choose an area to see who can help.">
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {categories.map((cat) => {
              const count = consultants.filter((c) => c.categoryId === cat.id).length;
              return (
                <Pressable
                  key={cat.id}
                  onPress={signUp}
                  accessibilityRole="button"
                  accessibilityLabel={`${cat.name}: ${cat.description}. ${count} consultants`}
                  className="w-[48.5%] gap-2 rounded-card border border-line/70 bg-surface p-4 shadow-card active:opacity-85">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-red-tint">
                    <Icon name={categoryIcon(cat.id)} size={20} color={colors.red} />
                  </View>
                  <Text className="text-heading text-fg">{cat.name}</Text>
                  <Text className="text-caption text-fg-muted" numberOfLines={2}>
                    {cat.description}
                  </Text>
                  <Text className="text-label text-red">
                    {count === 0 ? 'Coming soon' : `${count} consultant${count === 1 ? '' : 's'}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* How it works */}
        <Section title="How SaveMan works" subtitle="Three steps from question to answer.">
          <View className="rounded-card border border-line/70 bg-surface px-4 py-2 shadow-card">
            {steps.map((s, i) => (
              <View key={s.title} className={`flex-row gap-3.5 py-3.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                <View className="h-9 w-9 items-center justify-center rounded-full bg-ink">
                  <Text className="text-label text-on-dark">{i + 1}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Icon name={s.icon} size={16} color={colors.red} />
                    <Text className="text-heading text-fg">{s.title}</Text>
                  </View>
                  <Text className="text-body text-fg-muted">{s.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* Top-rated consultants */}
        {topRated.length > 0 && (
          <Section title="Top-rated consultants" subtitle="Log in to see full profiles and book a session.">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-3 px-5 pb-1">
              {topRated.map((c) => (
                <ConsultantPreview key={c.id} consultant={c} categoryName={categoryName(c.categoryId)} onPress={logIn} />
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Trust */}
        <Section title="Why people trust SaveMan">
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {trust.map((t) => (
              <View key={t.title} className="w-[48.5%] gap-2 rounded-card border border-line/70 bg-surface p-4 shadow-card">
                <View className={`h-10 w-10 items-center justify-center rounded-full ${t.tint}`}>
                  <Icon name={t.icon} size={18} color={t.color} />
                </View>
                <Text className="text-heading text-fg">{t.title}</Text>
                <Text className="text-caption text-fg-muted">{t.text}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Testimonial */}
        {featured && featuredConsultant && (
          <View className="gap-3 rounded-card border border-gold/40 bg-gold-tint p-5">
            <Stars rating={featured.rating} size={16} />
            <Text className="text-[16px] italic leading-[24px] text-fg">“{featured.comment.trim()}”</Text>
            <Text className="text-label text-fg-muted">
              {featuredClient?.name.split(' ')[0] ?? 'A SaveMan client'}
              {featuredClient?.role === 'client' ? `, ${featuredClient.city}` : ''} · about {featuredConsultant.name}
            </Text>
          </View>
        )}

        {/* For consultants */}
        <View className="gap-3 overflow-hidden rounded-card p-5">
          <HeroTexture />
          <View className="flex-row items-center gap-2">
            <Icon name="briefcase" size={18} color={colors.gold} />
            <Text className="text-label uppercase tracking-[1.5px] text-gold">For consultants</Text>
          </View>
          <Text className="text-title text-on-dark">Grow your practice with SaveMan</Text>
          {['Reach clients in every province', 'Set your own services, prices and hours', 'Manage bookings and messages in one place'].map(
            (point) => (
              <View key={point} className="flex-row items-center gap-2.5">
                <Icon name="check" size={16} color={colors.gold} />
                <Text className="flex-1 text-body text-on-dark-muted">{point}</Text>
              </View>
            ),
          )}
          <View className="mt-2">
            <Button title="Apply as a consultant" onPress={() => router.push({ pathname: '/sign-up', params: { role: 'consultant' } })} />
          </View>
        </View>

        {/* FAQ */}
        <Section title="Questions people ask">
          <View className="rounded-card border border-line/70 bg-surface px-4 shadow-card">
            {faqs.map((f, i) => (
              <FaqItem key={f.q} question={f.q} answer={f.a} first={i === 0} />
            ))}
          </View>
        </Section>

        {/* Towns + final call to action */}
        {towns.length > 0 && (
          <View className="flex-row items-start gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
            <Icon name="pin" size={20} color={colors.red} />
            <View className="flex-1 gap-0.5">
              <Text className="text-heading text-fg">Consultants in {towns.length} towns</Text>
              <Text className="text-body text-fg-muted">{towns.join(' · ')}, plus phone and video sessions anywhere in PNG.</Text>
            </View>
          </View>
        )}

        <View className="gap-3">
          <Text className="text-center text-title text-fg">Ready to get expert advice?</Text>
          <Button title="Create a free account" onPress={signUp} />
          <Button title="I already have an account" variant="outline" onPress={logIn} />
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className="text-title text-fg">{title}</Text>
        {subtitle && <Text className="text-body text-fg-muted">{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

function Stat({ value, label, star }: { value: string; label: string; star?: boolean }) {
  return (
    <View className="flex-1 gap-0.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
      <View className="flex-row items-center gap-1">
        {star && <Icon name="star" size={16} color={colors.gold} />}
        <Text className="text-[22px] font-extrabold text-on-dark">{value}</Text>
      </View>
      <Text className="text-caption text-on-dark-muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function ConsultantPreview({ consultant: c, categoryName, onPress }: { consultant: Consultant; categoryName: string; onPress: () => void }) {
  const prices = c.services.map((s) => s.price);
  const from = prices.length ? Math.min(...prices) : c.hourlyRate;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}, ${c.title}, ${c.location.city}. Log in to view profile`}
      className="w-[230px] gap-2.5 rounded-card border border-line/70 bg-surface p-4 shadow-card active:opacity-85">
      <View className="flex-row items-center gap-3">
        <Avatar name={c.name} uri={c.avatarUri} />
        <View className="flex-1 gap-0.5">
          <Text className="text-heading text-fg" numberOfLines={1}>
            {c.name}
          </Text>
          <RatingSummary rating={c.rating} count={c.reviewCount} />
        </View>
      </View>
      <Text className="text-body text-fg" numberOfLines={2}>
        {c.title}
      </Text>
      <VerifiedBadge compact />
      <View className="flex-row items-center justify-between border-t border-line pt-2.5">
        <View className="flex-row items-center gap-1">
          <Icon name="pin" size={14} color={colors.textMuted} />
          <Text className="text-caption text-fg-muted">{c.location.city}</Text>
        </View>
        {from > 0 && <Text className="text-label text-fg">from {formatKina(from)}</Text>}
      </View>
      {categoryName ? <Text className="text-caption text-red">{categoryName}</Text> : null}
    </Pressable>
  );
}

function FaqItem({ question, answer, first }: { question: string; answer: string; first: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View className={first ? '' : 'border-t border-line'}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-3 py-4 active:opacity-70">
        <Icon name="help" size={18} color={colors.red} />
        <Text className="flex-1 text-[15px] font-semibold text-fg">{question}</Text>
        <View className={open ? 'rotate-180' : ''}>
          <Icon name="chevronDown" size={18} color={colors.textMuted} />
        </View>
      </Pressable>
      {open && <Text className="pb-4 pl-[30px] text-body leading-[22px] text-fg-muted">{answer}</Text>}
    </View>
  );
}

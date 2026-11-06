import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark, HeroTexture, PatternBand, Wordmark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';

const highlights: { icon: IconName; title: string; text: string }[] = [
  { icon: 'verified', title: 'Verified experts', text: 'Every consultant is checked by the SaveMan team.' },
  { icon: 'calendar', title: 'Book in minutes', text: 'In person, by phone or video, across all provinces.' },
  { icon: 'chat', title: 'Message directly', text: 'Ask questions before and after your session.' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-sand">
      <View className="gap-4 overflow-hidden px-6 pb-10" style={{ paddingTop: insets.top + 32 }}>
        <HeroTexture />
        <View className="mb-3 flex-row items-center gap-3">
          <BrandMark size={60} />
          <Wordmark light />
        </View>
        <Text className="text-label uppercase tracking-[2px] text-gold">“Saveman” · Tok Pisin for an expert</Text>
        <Text className="text-display text-on-dark">Find trusted consultants across Papua New Guinea.</Text>
        <Text className="text-body leading-[22px] text-on-dark-muted">
          From Port Moresby to the Highlands and the Islands, expert advice is a booking away.
        </Text>
      </View>
      <PatternBand />

      <View className="flex-1 justify-between gap-6 p-5" style={{ paddingBottom: insets.bottom + 24 }}>
        <View className="rounded-card bg-surface px-4 py-2 shadow-card">
          {highlights.map((h, i) => (
            <View key={h.title} className={`flex-row items-center gap-3.5 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-red-tint">
                <Icon name={h.icon} size={20} color={colors.red} />
              </View>
              <View className="flex-1">
                <Text className="text-heading text-fg">{h.title}</Text>
                <Text className="text-body text-fg-muted">{h.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <Button title="Create an account" onPress={() => router.push('/sign-up')} />
          <Button title="Log in" variant="outline" onPress={() => router.push('/login')} />
        </View>
      </View>
    </View>
  );
}

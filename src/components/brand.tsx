import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { colors } from '@/constants/theme';

/** Sawtooth band inspired by PNG tapa cloth and bilum patterns. */
export function PatternBand({ height = 14, count = 24 }: { height?: number; count?: number }) {
  return (
    <View
      className="flex-row items-end overflow-hidden bg-ink"
      style={{ height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        // Triangles are drawn with borders, so their geometry stays in style.
        <View
          key={i}
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: height,
            borderRightWidth: height,
            borderBottomWidth: height,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: i % 2 === 0 ? colors.red : colors.gold,
          }}
        />
      ))}
    </View>
  );
}

/** App logo, matching the app icon: a feathered headdress with a tapa headband on deep ink with a crimson glow. */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <View
      className="overflow-hidden border border-gold/50 bg-ink-deep"
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      accessibilityRole="image"
      accessibilityLabel="SaveMan logo">
      <Image source={require('@/assets/images/logo.png')} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

/**
 * Brand background for dark headers: deep ink, a crimson glow top-right and faint tapa-cloth linework.
 * Place it as the first child of a header; the header should have `overflow-hidden`.
 */
export function HeroTexture() {
  return (
    <View className="absolute inset-0 bg-ink-deep" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image
        source={require('@/assets/images/hero-texture.png')}
        contentFit="cover"
        contentPosition="top"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <View>
      <Text className={`text-[26px] font-extrabold tracking-[-0.5px] ${light ? 'text-on-dark' : 'text-ink'}`}>SaveMan</Text>
      <Text className={`-mt-0.5 text-[11px] font-bold tracking-[4px] ${light ? 'text-gold' : 'text-gold-dark'}`}>CONSULTANT</Text>
    </View>
  );
}

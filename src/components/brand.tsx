import { Image } from 'expo-image';
import { Text, View } from 'react-native';

// Full class strings (not built from numbers) so Tailwind can find them.
const bandSizes = {
  lg: { band: 'h-[14px]', triangle: 'border-x-[14px] border-b-[14px]', count: 24 },
  md: { band: 'h-[10px]', triangle: 'border-x-[10px] border-b-[10px]', count: 40 },
  sm: { band: 'h-[8px]', triangle: 'border-x-[8px] border-b-[8px]', count: 40 },
} as const;

/** Sawtooth band inspired by PNG tapa cloth and bilum patterns. */
export function PatternBand({ size = 'lg' }: { size?: keyof typeof bandSizes }) {
  const s = bandSizes[size];
  return (
    <View
      className={`flex-row items-end overflow-hidden bg-ink ${s.band}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: s.count }, (_, i) => (
        // Triangles drawn with borders, alternating red and gold.
        <View key={i} className={`h-0 w-0 border-x-transparent ${s.triangle} ${i % 2 === 0 ? 'border-b-red' : 'border-b-gold'}`} />
      ))}
    </View>
  );
}

// Corner radius is about a quarter of the size, matching the app icon.
const markSizes = {
  lg: 'h-[52px] w-[52px] rounded-[14px]',
  sm: 'h-9 w-9 rounded-[9px]',
} as const;

/** App logo, matching the app icon: a feathered headdress with a tapa headband on deep ink with a crimson glow. */
export function BrandMark({ size = 'lg' }: { size?: keyof typeof markSizes }) {
  return (
    <View
      className={`overflow-hidden border border-gold/50 bg-ink-deep ${markSizes[size]}`}
      accessibilityRole="image"
      accessibilityLabel="SaveMan logo">
      <Image source={require('@/assets/images/logo.png')} className="h-full w-full" />
    </View>
  );
}

/**
 * Brand background for dark headers: deep ink with Papua New Guinea motifs (bird of paradise,
 * Southern Cross, tapa and bilum bands, Sepik spirals).
 * Place it as the first child of a header; the header should have `overflow-hidden`.
 */
export function HeroTexture() {
  return (
    <View className="absolute inset-0 bg-ink-deep" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={require('@/assets/images/hero-texture.png')} contentFit="cover" contentPosition="top" className="h-full w-full" />
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

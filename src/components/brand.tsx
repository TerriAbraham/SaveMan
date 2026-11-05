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

/** App logo: diagonal split like the PNG flag (red upper-right, black lower-left) with a gold star. */
export function BrandMark({ size = 56 }: { size?: number }) {
  // A rotated square whose lower-left edge runs exactly along the tile's diagonal.
  const side = size * 2;
  const centre = size * Math.SQRT1_2;
  return (
    <View
      className="items-center justify-center overflow-hidden border-2 border-gold bg-ink"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}>
      <View
        className="absolute rotate-45 bg-red"
        style={{ width: side, height: side, left: centre - side / 2, top: -centre - side / 2 }}
      />
      <Text className="font-black text-on-dark" style={{ fontSize: size * 0.5 }}>
        S
      </Text>
      <Text className="absolute text-gold" style={{ fontSize: size * 0.22, bottom: size * 0.06, left: size * 0.12 }}>
        ★
      </Text>
    </View>
  );
}

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <View>
      <Text className={`text-[26px] font-extrabold tracking-[-0.5px] ${light ? 'text-on-dark' : 'text-ink'}`}>SaveMan</Text>
      <Text className="-mt-0.5 text-[11px] font-bold tracking-[4px] text-gold">CONSULTANT</Text>
    </View>
  );
}

import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

/** Sawtooth band inspired by PNG tapa cloth and bilum patterns. */
export function PatternBand({ height = 14, count = 24 }: { height?: number; count?: number }) {
  return (
    <View style={[styles.band, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
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
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <View
        style={[
          styles.markRed,
          { width: side, height: side, left: centre - side / 2, top: -centre - side / 2 },
        ]}
      />
      <Text style={[styles.markLetter, { fontSize: size * 0.5 }]}>S</Text>
      <Text style={[styles.markStar, { fontSize: size * 0.22, bottom: size * 0.06, left: size * 0.12 }]}>★</Text>
    </View>
  );
}

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <View>
      <Text style={[styles.word, { color: light ? colors.textOnDark : colors.ink }]}>SaveMan</Text>
      <Text style={styles.sub}>CONSULTANT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  mark: {
    backgroundColor: colors.ink,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  markRed: {
    position: 'absolute',
    backgroundColor: colors.red,
    transform: [{ rotate: '45deg' }],
  },
  markLetter: { color: colors.textOnDark, fontWeight: '900' },
  markStar: { position: 'absolute', color: colors.gold },
  word: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 11, fontWeight: '700', letterSpacing: 4, color: colors.gold, marginTop: -2 },
});

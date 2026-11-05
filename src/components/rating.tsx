import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

/** Compact "★ 4.8 (42)". Consultants without reviews show "New". */
export function RatingSummary({ rating, count, light }: { rating: number; count: number; light?: boolean }) {
  if (count === 0) {
    return <Text className={`text-label ${light ? 'text-on-dark-muted' : 'text-fg-muted'}`}>New</Text>;
  }
  return (
    <View className="flex-row items-center gap-1" accessibilityLabel={`Rated ${rating} out of 5 from ${count} reviews`}>
      <Icon name="star" size={14} color={colors.gold} />
      <Text className={`text-label ${light ? 'text-on-dark' : 'text-fg'}`}>{rating.toFixed(1)}</Text>
      <Text className={`text-label font-normal ${light ? 'text-on-dark-muted' : 'text-fg-muted'}`}>({count})</Text>
    </View>
  );
}

/** Row of five stars for a single review. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row gap-0.5" accessibilityLabel={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" size={size} color={n <= Math.round(rating) ? colors.gold : colors.border} />
      ))}
    </View>
  );
}

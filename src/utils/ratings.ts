/**
 * Adds (change = 1) or removes (change = -1) one review from a running average.
 * Kept to one decimal place, as shown in the app. Removing the last review resets to 0.
 */
export function adjustAverage(rating: number, reviewCount: number, value: number, change: 1 | -1) {
  const count = Math.max(0, reviewCount + change);
  if (count === 0) return { rating: 0, reviewCount: 0 };
  const total = rating * reviewCount + value * change;
  const average = Math.min(5, Math.max(1, total / count));
  return { rating: Math.round(average * 10) / 10, reviewCount: count };
}

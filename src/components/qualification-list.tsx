import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import type { Qualification } from '@/data/types';

/** Degrees, certificates and licences, newest first. Pass `onRemove` to show a remove button on each (profile editor). */
export function QualificationList({
  qualifications,
  emptyText = 'No qualifications listed yet.',
  onRemove,
}: {
  qualifications: Qualification[];
  emptyText?: string;
  onRemove?: (id: string) => void;
}) {
  if (qualifications.length === 0) return <Text className="text-body text-fg-muted">{emptyText}</Text>;

  const sorted = [...qualifications].sort((a, b) => b.year - a.year);
  return (
    <View className="gap-3">
      {sorted.map((q, i) => (
        <View key={q.id} className={`flex-row items-start gap-3 ${i > 0 ? 'border-t border-line pt-3' : ''}`}>
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-gold-tint">
            <Icon name="award" size={18} color={colors.ink} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-label text-fg">{q.name}</Text>
            <Text className="text-caption text-fg-muted">
              {q.issuer} · {q.year}
            </Text>
            {q.licenceNumber && <Text className="text-caption text-fg-muted">Licence no. {q.licenceNumber}</Text>}
          </View>
          {onRemove && (
            <Pressable
              onPress={() => onRemove(q.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${q.name}`}
              className="active:opacity-70">
              <Icon name="close" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

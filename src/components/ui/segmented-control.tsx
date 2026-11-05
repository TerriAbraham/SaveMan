import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { colors } from '@/constants/theme';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/** Two or three mutually exclusive tabs inside a screen (Upcoming / Past, Visible / Removed ...). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  surface = 'sand',
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Track colour: 'sand' on white panels, 'surface' on the sand page background. */
  surface?: 'sand' | 'surface';
}) {
  return (
    <View
      className={`flex-row gap-1 rounded-xl p-1 ${surface === 'sand' ? 'bg-sand' : 'border border-line bg-surface'}`}
      accessibilityRole="tablist">
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg py-2.5 ${selected ? 'bg-ink' : ''}`}>
            {s.icon && <Icon name={s.icon} size={18} color={selected ? colors.textOnDark : colors.textMuted} />}
            <Text className={`text-[14px] font-semibold ${selected ? 'text-on-dark' : 'text-fg-muted'}`}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

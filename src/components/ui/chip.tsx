import { Pressable, Text } from 'react-native';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full border-[1.5px] px-3.5 py-2 ${selected ? 'border-ink bg-ink' : 'border-line bg-surface'}`}>
      <Text className={`text-[14px] font-semibold ${selected ? 'text-on-dark' : 'text-fg'}`}>{label}</Text>
    </Pressable>
  );
}

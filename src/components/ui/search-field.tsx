import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';

/** Search box with a clear button, used on every searchable list. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  label,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Spoken by screen readers. */
  label: string;
}) {
  return (
    <View className="min-h-[48px] flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-line bg-sand px-4">
      <Icon name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={label}
        className="flex-1 py-2.5 text-[16px] text-fg"
      />
      {value !== '' && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

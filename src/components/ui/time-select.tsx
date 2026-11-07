import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { colors } from '@/constants/theme';
import { formatTime, fromMinutes } from '@/utils/dates';

// Half-hour steps from 6 am to 10 pm, which covers normal consulting hours in PNG.
const TIMES = Array.from({ length: 33 }, (_, i) => fromMinutes(6 * 60 + i * 30));

/** A button showing a time; tapping opens a bottom sheet of half-hour options. */
export function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (time: string) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatTime(value)}. Change`}
        className="flex-1 flex-row items-center justify-between rounded-lg border-[1.5px] border-line bg-surface px-3 py-2.5 active:opacity-70">
        <View>
          <Text className="text-caption text-fg-muted">{label}</Text>
          <Text className="text-[15px] font-semibold text-fg">{formatTime(value)}</Text>
        </View>
        <Icon name="clock" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-ink/50" onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View className="max-h-[60%] rounded-t-card bg-surface" style={{ paddingBottom: insets.bottom + 8 }}>
          <Text className="border-b border-line p-4 text-center text-heading text-fg">{label}</Text>
          <ScrollView contentContainerClassName="p-2">
            {TIMES.map((t) => {
              const selected = t === value;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-row items-center justify-between rounded-lg px-4 py-3 ${selected ? 'bg-red-tint' : ''}`}>
                  <Text className={`text-[16px] ${selected ? 'font-bold text-red' : 'text-fg'}`}>{formatTime(t)}</Text>
                  {selected && <Icon name="check" size={18} color={colors.red} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

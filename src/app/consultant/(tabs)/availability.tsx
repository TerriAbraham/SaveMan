import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { TimeSelect } from '@/components/ui/time-select';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import type { Consultant, TimeWindow, WeeklyAvailability } from '@/data/types';
import { normalizeAvailability, validateAvailability, WEEK_ORDER, type Weekday } from '@/utils/availability';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MAX_BLOCKS = 3;

export default function AvailabilityScreen() {
  const { user } = useAuth();
  if (user?.role !== 'consultant') return null;
  // Remount the editor if the saved availability changes elsewhere.
  return <AvailabilityEditor key={JSON.stringify(user.availability)} consultant={user} />;
}

function AvailabilityEditor({ consultant }: { consultant: Consultant }) {
  const { updateConsultant } = useAuth();
  const [week, setWeek] = useState<WeeklyAvailability>(consultant.availability);
  const [errors, setErrors] = useState<Partial<Record<Weekday, string>>>({});

  const dirty = JSON.stringify(normalizeAvailability(week)) !== JSON.stringify(normalizeAvailability(consultant.availability));

  function setDay(day: Weekday, windows: TimeWindow[]) {
    setWeek((w) => ({ ...w, [day]: windows }));
    setErrors((e) => ({ ...e, [day]: undefined }));
  }

  function save() {
    const next = validateAvailability(week);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateConsultant(consultant.id, { availability: normalizeAvailability(week) });
    Alert.alert('Availability saved', 'Clients will only see times inside these hours.');
  }

  return (
    <View className="flex-1 bg-sand">
      <ScrollView contentContainerClassName="gap-3 p-4 pb-8">
        <Text className="text-body text-fg-muted">
          Set the hours clients can book you. Changes apply to new bookings only; existing bookings stay as they are.
        </Text>

        {WEEK_ORDER.map((day) => {
          const windows = week[day] ?? [];
          const on = windows.length > 0;
          return (
            <View key={day} className={`gap-3 rounded-card border bg-surface p-4 ${errors[day] ? 'border-red-dark' : 'border-line'}`}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-heading text-fg">{DAY_NAMES[day]}</Text>
                  <Text className="text-caption text-fg-muted">{on ? `${windows.length} time block${windows.length > 1 ? 's' : ''}` : 'Not available'}</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={(v) => setDay(day, v ? [{ start: '09:00', end: '17:00' }] : [])}
                  trackColor={{ true: colors.red, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel={`Available on ${DAY_NAMES[day]}`}
                />
              </View>

              {windows.map((w, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <TimeSelect
                    label="From"
                    value={w.start}
                    onChange={(t) => setDay(day, windows.map((x, j) => (j === i ? { ...x, start: t } : x)))}
                  />
                  <TimeSelect
                    label="To"
                    value={w.end}
                    onChange={(t) => setDay(day, windows.map((x, j) => (j === i ? { ...x, end: t } : x)))}
                  />
                  <Pressable
                    onPress={() => setDay(day, windows.filter((_, j) => j !== i))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove time block"
                    className="h-10 w-10 items-center justify-center">
                    <Icon name="close" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}

              {on && windows.length < MAX_BLOCKS && (
                <Pressable
                  onPress={() => {
                    // Start the new block after the last one ends, e.g. an afternoon after a morning.
                    const lastEnd = windows[windows.length - 1].end;
                    const startH = Math.min(Number(lastEnd.slice(0, 2)) + 1, 20);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    setDay(day, [...windows, { start: `${pad(startH)}:00`, end: `${pad(Math.min(startH + 2, 22))}:00` }]);
                  }}
                  accessibilityRole="button"
                  className="flex-row items-center gap-1.5 self-start active:opacity-70">
                  <Text className="text-label text-red">+ Add time block</Text>
                </Pressable>
              )}

              {errors[day] && <Text className="text-caption text-red-dark">{errors[day]}</Text>}
            </View>
          );
        })}
      </ScrollView>

      <View className="border-t border-line bg-surface p-4">
        <Button title={dirty ? 'Save availability' : 'No changes'} disabled={!dirty} onPress={save} />
      </View>
    </View>
  );
}

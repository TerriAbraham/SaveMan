import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { modeMeta } from '@/components/booking-card';
import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Booking } from '@/data/types';
import { usePublicConsultant } from '@/hooks/use-directory';
import { getSlots, worksOn } from '@/utils/availability';
import { addDays, formatTime, fromISODate, toISODate } from '@/utils/dates';
import { formatDate, formatDuration, formatKina } from '@/utils/format';

const DAYS_AHEAD = 14;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BookSessionScreen() {
  const { id, service } = useLocalSearchParams<{ id: string; service?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { bookings, createBooking } = useData();
  const consultant = usePublicConsultant(id);

  // `service` is a service id from the profile page; fall back to the first service.
  const [serviceId, setServiceId] = useState<string | null>(service ?? null);
  const [mode, setMode] = useState<Booking['mode']>('in-person');
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!consultant || !user || consultant.services.length === 0) {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Book a session" fallbackHref="/client" />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-body text-fg-muted">This consultant is not taking bookings right now.</Text>
        </View>
      </View>
    );
  }

  const selectedService = consultant.services.find((s) => s.id === serviceId) ?? consultant.services[0];
  const today = new Date();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const iso = toISODate(addDays(today, i));
    const open =
      worksOn(consultant, iso) &&
      getSlots(consultant, iso, selectedService.durationMins, bookings).some((s) => s.available);
    return { iso, open };
  });
  // Default to the first day with a free slot.
  const date = pickedDate ?? days.find((d) => d.open)?.iso ?? days[0].iso;
  const slots = getSlots(consultant, date, selectedService.durationMins, bookings);
  const timeStillFree = time !== null && slots.some((s) => s.time === time && s.available);

  function chooseService(id: string) {
    setServiceId(id);
    setTime(null); // a longer service may not fit the old slot
    setError(null);
  }

  function chooseDate(iso: string) {
    setPickedDate(iso);
    setTime(null);
    setError(null);
  }

  function confirm() {
    if (!consultant || !time || !timeStillFree) return;
    const result = createBooking({ consultantId: consultant.id, serviceId: selectedService.id, date, time, mode, note });
    if (result.error !== undefined) {
      setError(result.error);
      setTime(null);
      return;
    }
    router.replace({ pathname: '/client/booking/[id]', params: { id: result.booking.id, justBooked: '1' } });
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Book a session" subtitle={consultant.name} fallbackHref="/client" />
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Step number={1} title="Choose a service">
          {consultant.services.map((s) => {
            const selected = s.id === selectedService.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => chooseService(s.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                className={`flex-row items-center gap-3 rounded-xl border-[1.5px] p-3 ${selected ? 'border-red bg-red-tint' : 'border-line bg-surface'}`}>
                <View
                  className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-red' : 'border-line'}`}>
                  {selected && <View className="h-2.5 w-2.5 rounded-full bg-red" />}
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-fg">{s.name}</Text>
                  <Text className="text-caption text-fg-muted">{formatDuration(s.durationMins)}</Text>
                </View>
                <Text className="text-label text-fg">{formatKina(s.price)}</Text>
              </Pressable>
            );
          })}
        </Step>

        <Step number={2} title="How would you like to meet?">
          <View className="flex-row gap-2">
            {(Object.keys(modeMeta) as Booking['mode'][]).map((m) => {
              const selected = m === mode;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  className={`flex-1 items-center gap-1 rounded-xl border-[1.5px] py-3 ${selected ? 'border-ink bg-ink' : 'border-line bg-surface'}`}>
                  <Icon name={modeMeta[m].icon} size={20} color={selected ? colors.textOnDark : colors.textMuted} />
                  <Text className={`text-label ${selected ? 'text-on-dark' : 'text-fg'}`}>{modeMeta[m].label}</Text>
                </Pressable>
              );
            })}
          </View>
          {mode === 'in-person' && (
            <Text className="text-caption text-fg-muted">
              In-person sessions are held in {consultant.location.city}, {consultant.location.province}.
            </Text>
          )}
        </Step>

        <Step number={3} title="Pick a date">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {days.map((d) => {
              const selected = d.iso === date;
              const day = fromISODate(d.iso);
              return (
                <Pressable
                  key={d.iso}
                  disabled={!d.open}
                  onPress={() => chooseDate(d.iso)}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !d.open }}
                  accessibilityLabel={`${formatDate(d.iso)}${d.open ? '' : ', unavailable'}`}
                  className={`w-[60px] items-center gap-0.5 rounded-xl border-[1.5px] py-2.5 ${
                    selected ? 'border-red bg-red' : d.open ? 'border-line bg-surface' : 'border-line bg-sand opacity-50'
                  }`}>
                  <Text className={`text-caption ${selected ? 'text-on-dark' : 'text-fg-muted'}`}>{WEEKDAYS[day.getDay()]}</Text>
                  <Text className={`text-title ${selected ? 'text-on-dark' : 'text-fg'}`}>{day.getDate()}</Text>
                  <Text className={`text-caption ${selected ? 'text-on-dark' : 'text-fg-muted'}`}>{MONTHS[day.getMonth()]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Step>

        <Step number={4} title="Pick a time">
          {slots.length === 0 ? (
            <Text className="text-body text-fg-muted">No sessions on this day. Choose another date.</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {slots.map((s) => {
                const selected = s.time === time;
                return (
                  <Pressable
                    key={s.time}
                    disabled={!s.available}
                    onPress={() => setTime(s.time)}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !s.available }}
                    accessibilityLabel={`${formatTime(s.time)}${s.available ? '' : ', taken'}`}
                    className={`w-[31%] items-center rounded-xl border-[1.5px] py-2.5 ${
                      selected ? 'border-red bg-red' : s.available ? 'border-line bg-surface' : 'border-line bg-sand'
                    }`}>
                    <Text
                      className={`text-label ${selected ? 'text-on-dark' : s.available ? 'text-fg' : 'text-fg-muted line-through'}`}>
                      {formatTime(s.time)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text className="text-caption text-fg-muted">
            Crossed-out times are already booked. Times are for a {formatDuration(selectedService.durationMins)} session.
          </Text>
        </Step>

        <Step number={5} title="Anything the consultant should know?">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional: what you need help with"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
            className="min-h-[96px] rounded-xl border-[1.5px] border-line bg-surface p-3 text-[16px] text-fg"
          />
        </Step>
      </ScrollView>

      <View className="gap-2 border-t border-line bg-surface px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}
        <Text className="text-caption text-fg-muted" numberOfLines={1}>
          {time && timeStillFree
            ? `${selectedService.name} · ${formatDate(date)} at ${formatTime(time)} · ${modeMeta[mode].label}`
            : 'Choose a time to continue'}
        </Text>
        <Button
          title={`Request booking · ${formatKina(selectedService.price)}`}
          onPress={confirm}
          disabled={!timeStillFree}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <View className="h-6 w-6 items-center justify-center rounded-full bg-ink">
          <Text className="text-caption font-bold text-on-dark">{number}</Text>
        </View>
        <Text className="text-heading text-fg">{title}</Text>
      </View>
      {children}
    </View>
  );
}

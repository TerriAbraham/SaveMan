import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import type { Consultant, Service } from '@/data/types';
import { formatDuration } from '@/utils/format';
import { DURATION_OPTIONS, upsertService, validateService, type ServiceDraft, type ServiceErrors } from '@/utils/services';

/** Add (`id` = "new") or edit one of the signed-in consultant's services. */
export default function ServiceEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (user?.role !== 'consultant') return null;

  const existing = id === 'new' ? null : (user.services.find((s) => s.id === id) ?? null);
  if (id !== 'new' && !existing) {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Service" fallbackHref="/consultant/services" />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-body text-fg-muted">This service no longer exists.</Text>
        </View>
      </View>
    );
  }
  return <ServiceForm consultant={user} existing={existing} />;
}

function ServiceForm({ consultant, existing }: { consultant: Consultant; existing: Service | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateConsultant } = useAuth();

  const [draft, setDraft] = useState<ServiceDraft>({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    durationMins: existing?.durationMins ?? 60,
    price: existing ? String(existing.price) : '',
  });
  const [errors, setErrors] = useState<ServiceErrors>({});

  function set<K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function save() {
    const next = validateService(draft, consultant.services, existing?.id ?? null);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    updateConsultant(consultant.id, {
      services: upsertService(consultant.services, draft, existing?.id ?? null, `s-new-${Date.now()}`),
    });
    router.back();
  }

  function confirmDelete() {
    if (!existing) return;
    const lastOne = consultant.services.length === 1;
    Alert.alert(
      `Delete “${existing.name}”?`,
      lastOne
        ? 'This is your only service. Clients won’t be able to book you until you add another.'
        : 'Clients will no longer be able to book it. Existing bookings are not affected.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            updateConsultant(consultant.id, { services: consultant.services.filter((s) => s.id !== existing.id) });
            router.back();
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title={existing ? 'Edit service' : 'New service'} fallbackHref="/consultant/services" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-4 rounded-card border border-line bg-surface p-4">
          <TextField
            label="Service name"
            icon="briefcase"
            value={draft.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Business plan review"
            maxLength={60}
            error={errors.name}
          />
          <TextField
            label="Description (optional)"
            value={draft.description}
            onChangeText={(v) => set('description', v)}
            placeholder="What the client gets from this session"
            multiline
            maxLength={200}
            textAlignVertical="top"
            error={errors.description}
          />
          <View className="gap-2">
            <Text className="text-label text-fg">Length</Text>
            <View className="flex-row flex-wrap gap-2">
              {DURATION_OPTIONS.map((m) => (
                <Chip key={m} label={formatDuration(m)} selected={draft.durationMins === m} onPress={() => set('durationMins', m)} />
              ))}
            </View>
          </View>
          <TextField
            label="Price (Kina)"
            value={draft.price}
            onChangeText={(v) => set('price', v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 250"
            keyboardType="number-pad"
            error={errors.price}
          />
        </View>

        <Button title={existing ? 'Save changes' : 'Add service'} onPress={save} />
        {existing && <Button title="Delete service" variant="ghost" onPress={confirmDelete} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

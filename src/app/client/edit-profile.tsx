import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfilePhotoPicker } from '@/components/profile-photo-picker';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import type { Client } from '@/data/types';
import { cities } from '@/data/users';

export default function ClientEditProfileScreen() {
  const { user } = useAuth();
  if (user?.role !== 'client') return null;
  return <ClientProfileForm client={user} />;
}

function ClientProfileForm({ client }: { client: Client }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateOwnProfile } = useAuth();
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [city, setCity] = useState(client.city);
  const [photo, setPhoto] = useState(client.avatarUri);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const result = await updateOwnProfile({ name, phone, city, avatarUri: photo ?? null });
    setBusy(false);
    if (result) {
      setError(result);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Edit profile" subtitle={client.email} fallbackHref="/client/profile" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <ProfilePhotoPicker name={name} uri={photo} onChange={(uri) => setPhoto(uri ?? undefined)} />
        <View className="gap-4 rounded-card border border-line/70 bg-surface shadow-card p-4">
          <TextField label="Full name" icon="person" value={name} onChangeText={setName} autoComplete="name" />
          <TextField label="Phone" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <View className="gap-2">
            <Text className="text-label text-fg">Town or city</Text>
            <View className="flex-row flex-wrap gap-2">
              {cities.map((c) => (
                <Chip key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
              ))}
            </View>
          </View>
          <Text className="text-caption text-fg-muted">Your email is your login and can’t be changed here.</Text>
        </View>
        {error && <Text className="overflow-hidden rounded-lg bg-red-tint p-3 text-label text-red-dark">{error}</Text>}
        <Button title="Save changes" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

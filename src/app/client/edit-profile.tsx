import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateOwnProfile } = useAuth();
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [city, setCity] = useState(client.city);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const result = updateOwnProfile({ name, phone, city });
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
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-4 rounded-card border border-line bg-surface p-4">
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
        <Button title="Save changes" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

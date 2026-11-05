import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationPicker } from '@/components/maps/location-picker';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import type { Consultant } from '@/data/types';
import { places } from '@/data/users';
import { isInPNG, nearestPlace, type Coordinate } from '@/utils/geo';

export default function EditProfileScreen() {
  const { user } = useAuth();
  // Only consultants reach this screen; the guard keeps TypeScript and deep links honest.
  if (user?.role !== 'consultant') return null;
  return <EditProfileForm consultant={user} />;
}

function EditProfileForm({ consultant }: { consultant: Consultant }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateConsultant } = useAuth();

  const [title, setTitle] = useState(consultant.title);
  const [bio, setBio] = useState(consultant.bio);
  const [rate, setRate] = useState(consultant.hourlyRate ? String(consultant.hourlyRate) : '');
  const [address, setAddress] = useState(consultant.location.address);
  const [pin, setPin] = useState<Coordinate>({
    latitude: consultant.location.latitude,
    longitude: consultant.location.longitude,
  });
  const [mapActive, setMapActive] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; rate?: string; pin?: string }>({});

  // City and province always follow the pin, so filters and the profile stay consistent.
  const centre = nearestPlace(pin);

  function movePin(point: Coordinate) {
    setPin(point);
    setErrors((e) => ({ ...e, pin: undefined }));
  }

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access in Settings, or drag the pin on the map instead.');
        return;
      }
      const { coords } = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const point = { latitude: coords.latitude, longitude: coords.longitude };
      if (!isInPNG(point)) {
        Alert.alert('Outside Papua New Guinea', 'Your current location is outside PNG. Choose a town or drag the pin instead.');
        return;
      }
      movePin(point);
    } catch {
      Alert.alert('Could not get your location', 'Check that location services are on, or drag the pin instead.');
    } finally {
      setLocating(false);
    }
  }

  function save() {
    const next: typeof errors = {};
    const hourlyRate = Number(rate);
    if (title.trim().length < 3) next.title = 'Enter your professional title.';
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || !Number.isInteger(hourlyRate)) {
      next.rate = 'Enter a whole number of Kina, e.g. 200.';
    }
    if (!isInPNG(pin)) next.pin = 'Place your pin inside Papua New Guinea.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    updateConsultant(consultant.id, {
      title: title.trim(),
      bio: bio.trim(),
      hourlyRate,
      location: { ...centre, address: address.trim(), latitude: pin.latitude, longitude: pin.longitude },
    });
    router.back();
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Edit profile" subtitle={consultant.name} fallbackHref="/consultant/profile" />
      <ScrollView
        scrollEnabled={!mapActive}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="gap-4 rounded-card border border-line bg-surface p-4">
          <Text className="text-heading text-fg">About you</Text>
          <TextField label="Professional title" icon="briefcase" value={title} onChangeText={setTitle} error={errors.title} />
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="What you do and who you help"
            multiline
            maxLength={600}
            textAlignVertical="top"
          />
          <TextField
            label="Hourly rate (Kina)"
            value={rate}
            onChangeText={(v) => setRate(v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 200"
            keyboardType="number-pad"
            error={errors.rate}
          />
        </View>

        <View className="gap-4 rounded-card border border-line bg-surface p-4">
          <View className="gap-1">
            <Text className="text-heading text-fg">Location</Text>
            <Text className="text-body text-fg-muted">
              Clients see this pin on the map and on your profile. Choose your town, then tap the map or drag the pin to
              your office.
            </Text>
          </View>

          <TextField
            label="Street address"
            icon="pin"
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. Waigani Drive, Waigani"
          />

          <View className="gap-2">
            <Text className="text-label text-fg">Town</Text>
            <View className="flex-row flex-wrap gap-2">
              {Object.values(places).map((p) => (
                <Chip
                  key={p.city}
                  label={p.city}
                  selected={centre.city === p.city}
                  onPress={() => movePin({ latitude: p.latitude, longitude: p.longitude })}
                />
              ))}
            </View>
          </View>

          <LocationPicker value={pin} onChange={movePin} onInteractionChange={setMapActive} />
          <Text className="text-caption text-fg-muted">
            Nearest centre: {centre.city}, {centre.province} · {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
          </Text>
          {errors.pin && <Text className="text-caption text-red-dark">{errors.pin}</Text>}

          <Button title="Use my current location" variant="outline" loading={locating} onPress={useCurrentLocation} />
        </View>

        <Button title="Save changes" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

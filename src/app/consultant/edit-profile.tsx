import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationPicker } from '@/components/maps/location-picker';
import { ProfilePhotoPicker } from '@/components/profile-photo-picker';
import { QualificationList } from '@/components/qualification-list';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { SmallButton } from '@/components/ui/small-button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Consultant } from '@/data/types';
import { places } from '@/data/users';
import { isInPNG, nearestPlace, type Coordinate } from '@/utils/geo';

const emptyDraft = { name: '', issuer: '', year: '', licence: '' };

export default function EditProfileScreen() {
  const { user } = useAuth();
  // Only consultants reach this screen; the guard keeps TypeScript and deep links honest.
  if (user?.role !== 'consultant') return null;
  return <EditProfileForm consultant={user} />;
}

function EditProfileForm({ consultant }: { consultant: Consultant }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateConsultant, updateOwnProfile } = useAuth();
  const { categories } = useData();

  const [name, setName] = useState(consultant.name);
  const [phone, setPhone] = useState(consultant.phone);
  const [photo, setPhoto] = useState(consultant.avatarUri);
  const [categoryId, setCategoryId] = useState(consultant.categoryId);
  const [title, setTitle] = useState(consultant.title);
  const [bio, setBio] = useState(consultant.bio);
  const [rate, setRate] = useState(consultant.hourlyRate ? String(consultant.hourlyRate) : '');
  const [address, setAddress] = useState(consultant.location.address);
  const [pin, setPin] = useState<Coordinate>({
    latitude: consultant.location.latitude,
    longitude: consultant.location.longitude,
  });
  const [qualifications, setQualifications] = useState(consultant.qualifications);
  const [draft, setDraft] = useState(emptyDraft);
  const [mapActive, setMapActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<{
    contact?: string;
    title?: string;
    category?: string;
    rate?: string;
    qualification?: string;
    pin?: string;
  }>({});

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

  function addQualification() {
    const year = Number(draft.year);
    const error =
      draft.name.trim().length < 3
        ? 'Enter the qualification or licence name.'
        : draft.issuer.trim().length < 2
          ? 'Enter who issued it.'
          : !Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()
            ? 'Enter the year it was awarded, e.g. 2018.'
            : undefined;
    setErrors((e) => ({ ...e, qualification: error }));
    if (error) return;

    const licenceNumber = draft.licence.trim();
    setQualifications((prev) => [
      ...prev,
      { id: `q-${Date.now()}`, name: draft.name.trim(), issuer: draft.issuer.trim(), year, ...(licenceNumber && { licenceNumber }) },
    ]);
    setDraft(emptyDraft);
  }

  async function save() {
    if (saving) return;
    const next: typeof errors = {};
    const hourlyRate = Number(rate);
    if (title.trim().length < 3) next.title = 'Enter your professional title.';
    if (!categories.some((c) => c.id === categoryId)) next.category = 'Choose your area of expertise.';
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || !Number.isInteger(hourlyRate)) {
      next.rate = 'Enter a whole number of Kina, e.g. 200.';
    }
    // Don't silently drop a qualification that was typed but never added.
    if (Object.values(draft).some((v) => v.trim() !== '')) {
      next.qualification = 'Tap “Add qualification” to keep it, or clear the fields.';
    }
    if (!isInPNG(pin)) next.pin = 'Place your pin inside Papua New Guinea.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const contactError = await updateOwnProfile({ name, phone, avatarUri: photo ?? null });
    if (contactError) {
      setSaving(false);
      setErrors({ contact: contactError });
      // The Save button is far below the Contact card, so say it here too.
      Alert.alert('Could not save your profile', contactError);
      return;
    }
    const profileError = await updateConsultant({
      title: title.trim(),
      categoryId,
      bio: bio.trim(),
      hourlyRate,
      qualifications,
      location: { ...centre, address: address.trim(), latitude: pin.latitude, longitude: pin.longitude },
    });
    setSaving(false);
    if (profileError) {
      Alert.alert('Could not save your profile', profileError);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader title="Edit profile" subtitle={consultant.name} fallbackHref="/consultant/profile" />
      <ScrollView
        scrollEnabled={!mapActive}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <ProfilePhotoPicker name={name} uri={photo} onChange={(uri) => setPhoto(uri ?? undefined)} />
        <View className="gap-4 rounded-card border border-line/70 bg-surface shadow-card p-4">
          <Text className="text-heading text-fg">Contact</Text>
          <TextField label="Full name" icon="person" value={name} onChangeText={setName} autoComplete="name" />
          <TextField label="Phone" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          {errors.contact && <Text className="text-caption text-red-dark">{errors.contact}</Text>}
        </View>

        <View className="gap-4 rounded-card border border-line/70 bg-surface shadow-card p-4">
          <Text className="text-heading text-fg">About you</Text>
          <TextField label="Professional title" icon="briefcase" value={title} onChangeText={setTitle} error={errors.title} />
          <View className="gap-2">
            <Text className="text-label text-fg">Area of expertise</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>
            {errors.category && <Text className="text-caption text-red-dark">{errors.category}</Text>}
          </View>
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

        <View className="gap-4 rounded-card border border-line/70 bg-surface shadow-card p-4">
          <View className="gap-1">
            <Text className="text-heading text-fg">Qualifications & licences</Text>
            <Text className="text-body text-fg-muted">
              Degrees, certificates and practising licences. Clients see these on your profile, and SaveMan checks them
              when verifying you.
            </Text>
          </View>
          <QualificationList
            qualifications={qualifications}
            onRemove={(id) => setQualifications((prev) => prev.filter((q) => q.id !== id))}
          />

          <View className="gap-3 rounded-xl bg-sand p-3">
            <TextField
              label="Qualification or licence"
              icon="award"
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="e.g. Certified Practising Accountant"
            />
            <TextField
              label="Issued by"
              value={draft.issuer}
              onChangeText={(issuer) => setDraft((d) => ({ ...d, issuer }))}
              placeholder="e.g. CPA PNG"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label="Year"
                  value={draft.year}
                  onChangeText={(v) => setDraft((d) => ({ ...d, year: v.replace(/[^0-9]/g, '') }))}
                  placeholder="2018"
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <View className="flex-[1.6]">
                <TextField
                  label="Licence no. (optional)"
                  value={draft.licence}
                  onChangeText={(licence) => setDraft((d) => ({ ...d, licence }))}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            {errors.qualification && <Text className="text-caption text-red-dark">{errors.qualification}</Text>}
            <SmallButton label="Add qualification" icon="award" variant="outline" onPress={addQualification} />
          </View>
        </View>

        <View className="gap-4 rounded-card border border-line/70 bg-surface shadow-card p-4">
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

        <Button title="Save changes" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

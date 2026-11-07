import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { SmallButton } from '@/components/ui/small-button';
import { colors } from '@/constants/theme';

// Square crop. It's shrunk further before upload (shrinkPhoto).
const options: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  shape: 'oval',
  quality: 0.6,
};

/** The picked photo's address, or null when the picker was closed without one. */
function pickedUri(result: ImagePicker.ImagePickerResult) {
  return !result.canceled && result.assets?.[0]?.uri ? result.assets[0].uri : null;
}

/**
 * Profile photo for the edit-profile screens: choose from the library, take one, or remove it.
 * The new photo shows here straight away; it's uploaded when the profile is saved.
 */
export function ProfilePhotoPicker({ name, uri, onChange }: { name: string; uri?: string; onChange: (uri: string | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [opening, setOpening] = useState(false);

  // Android can close SaveMan's screen while the photo picker or crop screen is open (low memory),
  // which loses the photo. The picker keeps it, so pick it up when this screen opens again.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let live = true;
    ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (!live || !result) return;
        if ('code' in result) setError('That photo couldn’t be opened. Please choose it again.');
        else {
          const picked = pickedUri(result);
          if (picked) onChange(picked);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // Once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(launch: () => Promise<ImagePicker.ImagePickerResult>) {
    if (opening) return;
    setError(null);
    setOpening(true);
    try {
      const picked = pickedUri(await launch());
      if (picked) onChange(picked);
    } catch {
      setError('That photo couldn’t be opened. Try a different photo, or take a new one.');
    } finally {
      setOpening(false);
    }
  }

  // The system photo picker needs no permission on current iOS and Android.
  const choose = () => open(() => ImagePicker.launchImageLibraryAsync(options));

  async function takePhoto() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraBlocked(!permission.canAskAgain);
      setError('SaveMan needs camera access to take a photo. You can choose one from your photos instead.');
      return;
    }
    await open(() => ImagePicker.launchCameraAsync(options));
  }

  return (
    <View className="items-center gap-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <Pressable onPress={choose} accessibilityRole="button" accessibilityLabel="Change profile photo" className="active:opacity-80">
        <Avatar name={name || '?'} uri={uri} size="xl" />
        <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-red">
          <Icon name="camera" size={16} color={colors.textOnDark} />
        </View>
      </Pressable>
      <Text className="text-caption text-fg-muted">Clients and consultants see this photo on your profile, bookings and messages.</Text>
      <View className="flex-row flex-wrap justify-center gap-2">
        <SmallButton icon="photo" label={uri ? 'Change photo' : 'Choose photo'} onPress={choose} />
        {/* Browsers open a file chooser for both, so the camera button is phone-only. */}
        {Platform.OS !== 'web' && <SmallButton icon="camera" label="Take photo" variant="outline" onPress={takePhoto} />}
        {uri && <SmallButton icon="close" label="Remove" variant="danger" onPress={() => onChange(null)} />}
      </View>
      {error && (
        <View className="items-center gap-1">
          <Text className="text-center text-caption text-red-dark">{error}</Text>
          {cameraBlocked && (
            <Pressable onPress={() => Linking.openSettings()} hitSlop={8} accessibilityRole="button">
              <Text className="text-label text-red">Open settings</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

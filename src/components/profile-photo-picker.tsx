import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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

/** Profile photo for the edit-profile screens: choose from the library, take one, or remove it. */
export function ProfilePhotoPicker({ name, uri, onChange }: { name: string; uri?: string; onChange: (uri: string | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);

  async function choose() {
    setError(null);
    // The system photo picker needs no permission on current iOS and Android.
    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  async function takePhoto() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraBlocked(!permission.canAskAgain);
      setError('SaveMan needs camera access to take a photo. You can choose one from your photos instead.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(options);
    if (!result.canceled) onChange(result.assets[0].uri);
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

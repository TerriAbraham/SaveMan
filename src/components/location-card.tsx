import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LocationPreview } from '@/components/maps/location-preview';
import { colors } from '@/constants/theme';
import type { Location } from '@/data/types';
import { directionsUrl } from '@/utils/geo';

/** Map preview, address and a directions link for a consultant's office. */
export function LocationCard({ location, name, action }: { location: Location; name: string; action?: ReactNode }) {
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-heading text-fg">Location</Text>
        {action}
      </View>
      <LocationPreview location={location} name={name} />
      <View className="flex-row items-start gap-2.5">
        <Icon name="pin" size={18} color={colors.red} />
        <View className="flex-1">
          {location.address !== '' && <Text className="text-body text-fg">{location.address}</Text>}
          <Text className={location.address !== '' ? 'text-caption text-fg-muted' : 'text-body text-fg'}>
            {location.city}, {location.province}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => Linking.openURL(directionsUrl(location))}
        accessibilityRole="link"
        accessibilityHint="Opens Google Maps"
        className="flex-row items-center gap-1.5 self-start active:opacity-70">
        <Icon name="map" size={16} color={colors.red} />
        <Text className="text-label text-red">Get directions</Text>
      </Pressable>
    </View>
  );
}

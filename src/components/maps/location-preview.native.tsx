import { View } from 'react-native';
import { MapView, Marker } from '@/components/maps/styled-map-view';

import { MarkerPin } from '@/components/maps/marker-pin';
import { regionAround } from '@/utils/geo';

import type { LocationPreviewProps } from './location-preview';

/** Small static map with one pin, for profile pages. */
export function LocationPreview({ location, name }: LocationPreviewProps) {
  return (
    // Android maps ignore borderRadius, so the wrapper does the clipping.
    <View className="h-[180px] overflow-hidden rounded-xl">
      <MapView
        className="flex-1"
        // Controlled region so the map follows edits to the location.
        region={regionAround(location, 0.03)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel={`Map showing ${location.address || location.city}`}>
        <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} anchor={{ x: 0.5, y: 1 }}>
          <MarkerPin name={name} />
        </Marker>
      </MapView>
    </View>
  );
}

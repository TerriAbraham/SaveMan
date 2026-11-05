import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { MarkerPin } from '@/components/maps/marker-pin';
import { regionAround } from '@/utils/geo';

import type { LocationPickerProps } from './location-picker';

/** Tap the map or drag the pin to choose a point. */
export function LocationPicker({ value, onChange, onInteractionChange }: LocationPickerProps) {
  const mapRef = useRef<MapView>(null);
  const { latitude, longitude } = value;

  // Keep the pin in view when the value changes (city chip, current location, or a tap).
  useEffect(() => {
    mapRef.current?.animateToRegion(regionAround({ latitude, longitude }, 0.05), 300);
  }, [latitude, longitude]);

  return (
    // Touches on the map pause the parent ScrollView so panning the map doesn't scroll the page.
    <View
      className="h-[260px] overflow-hidden rounded-xl border-[1.5px] border-line"
      onTouchStart={() => onInteractionChange?.(true)}
      onTouchEnd={() => onInteractionChange?.(false)}
      onTouchCancel={() => onInteractionChange?.(false)}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={regionAround(value, 0.05)}
        onPress={(e) => onChange(e.nativeEvent.coordinate)}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}>
        <Marker
          coordinate={value}
          draggable
          anchor={{ x: 0.5, y: 1 }}
          onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}>
          <MarkerPin highlighted />
        </Marker>
      </MapView>
    </View>
  );
}

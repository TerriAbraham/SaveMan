import { useEffect, useRef } from 'react';
import MapView, { Marker } from 'react-native-maps';

import { MarkerPin } from '@/components/maps/marker-pin';
import type { Consultant } from '@/data/types';
import { PNG_REGION, regionAround } from '@/utils/geo';

import type { ConsultantMapProps } from './consultant-map';

// No `provider` prop: Google Maps on Android, Apple Maps on iOS. Both work in Expo Go without an API key.
export function ConsultantMap({ consultants, onSelect }: ConsultantMapProps) {
  const mapRef = useRef<MapView>(null);
  const visibleKey = consultants.map((c) => c.id).join(',');

  // Re-frame whenever the set of pins changes (e.g. a category filter).
  useEffect(() => {
    fitTo(mapRef.current, consultants);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refit when the visible ids change
  }, [visibleKey]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={PNG_REGION}
      onMapReady={() => fitTo(mapRef.current, consultants)}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}>
      {consultants.map((c) => (
        <Marker
          key={c.id}
          coordinate={{ latitude: c.location.latitude, longitude: c.location.longitude }}
          anchor={{ x: 0.5, y: 1 }}
          accessibilityLabel={`${c.name}, ${c.location.city}. Opens profile.`}
          onPress={() => onSelect(c.id)}>
          <MarkerPin name={c.name} />
        </Marker>
      ))}
    </MapView>
  );
}

function fitTo(map: MapView | null, consultants: Consultant[]) {
  if (!map || consultants.length === 0) return;
  if (consultants.length === 1) {
    map.animateToRegion(regionAround(consultants[0].location, 0.3), 400);
    return;
  }
  map.fitToCoordinates(
    consultants.map((c) => ({ latitude: c.location.latitude, longitude: c.location.longitude })),
    { edgePadding: { top: 140, right: 60, bottom: 80, left: 60 }, animated: true },
  );
}

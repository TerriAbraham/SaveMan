import { places } from '@/data/users';
import type { Place } from '@/data/types';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends Coordinate {
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Mainland PNG plus the islands, as a starting view. */
export const PNG_REGION: MapRegion = {
  latitude: -6.6,
  longitude: 147.3,
  latitudeDelta: 10,
  longitudeDelta: 13,
};

/** A close-up region around one point (about 2 km across). */
export function regionAround(point: Coordinate, delta = 0.02): MapRegion {
  return { latitude: point.latitude, longitude: point.longitude, latitudeDelta: delta, longitudeDelta: delta };
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: Coordinate, b: Coordinate) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The PNG town centre closest to a point; used to keep city/province in step with a dropped pin. */
export function nearestPlace(point: Coordinate): Place {
  return Object.values(places).reduce((best, p) => (distanceKm(point, p) < distanceKm(point, best) ? p : best));
}

/** Rough bounding box for PNG; pins outside it are rejected. */
export function isInPNG(point: Coordinate) {
  return point.latitude <= 0 && point.latitude >= -12 && point.longitude >= 140.8 && point.longitude <= 160;
}

/** Opens Google Maps (app or web) at a pin. Works without an API key. */
export function directionsUrl(point: Coordinate) {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}

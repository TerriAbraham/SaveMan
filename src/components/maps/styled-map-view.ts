import { cssInterop } from 'nativewind';
import MapView, { Marker } from 'react-native-maps';

// Lets MapView take `className` (NativeWind turns it into `style`). Only the .native map
// components import this, so react-native-maps stays out of the web build.
cssInterop(MapView, { className: 'style' });

export { MapView, Marker };

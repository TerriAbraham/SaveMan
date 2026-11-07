import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';

// NativeWind styles React Native's own components out of the box. Third-party components need
// registering once so their `className` is turned into `style`. (Maps: components/maps/styled-map-view.ts.)
cssInterop(Image, { className: 'style' });

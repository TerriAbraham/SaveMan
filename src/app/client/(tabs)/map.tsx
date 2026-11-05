import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ClientMapScreen() {
  return (
    <PlaceholderScreen
      icon="map"
      title="Consultants on the map"
      phase={2}
      features={[
        'Google Map of verified consultants across PNG',
        'Tap a pin to preview and open the profile',
        'Filter pins by category',
      ]}
    />
  );
}

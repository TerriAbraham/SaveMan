import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AdminBookingsScreen() {
  return (
    <PlaceholderScreen
      icon="list"
      title="All bookings"
      phase={4}
      features={['Every booking on the platform with its status', 'Filter by status, consultant or date']}
    />
  );
}

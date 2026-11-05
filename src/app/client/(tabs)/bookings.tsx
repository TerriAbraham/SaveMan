import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ClientBookingsScreen() {
  return (
    <PlaceholderScreen
      icon="calendar"
      title="My bookings"
      phase={2}
      features={['Upcoming and past sessions', 'Cancel a pending or confirmed booking', 'Leave a review after a completed session']}
    />
  );
}

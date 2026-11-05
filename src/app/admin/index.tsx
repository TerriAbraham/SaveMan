import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AdminOverviewScreen() {
  return (
    <PlaceholderScreen
      greeting="Admin dashboard"
      icon="dashboard"
      title="Platform overview"
      phase={4}
      features={[
        'Totals for clients, consultants and bookings',
        'Pending verifications needing review',
        'Recent activity and reviews',
        'Manage consultant categories',
      ]}
    />
  );
}

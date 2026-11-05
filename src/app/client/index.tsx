import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAuth } from '@/context/auth-context';

export default function ClientHomeScreen() {
  const { user } = useAuth();

  return (
    <PlaceholderScreen
      greeting={`Hi ${user?.name.split(' ')[0]}, what do you need help with?`}
      icon="search"
      title="Search consultants"
      phase={2}
      features={[
        'Search by name, skill or keyword',
        'Filter by category, city, price and rating',
        'Verified badge on every approved consultant',
        'Consultant profiles with reviews and booking',
      ]}
    />
  );
}

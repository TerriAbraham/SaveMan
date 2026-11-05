import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAuth } from '@/context/auth-context';

export default function ConsultantDashboardScreen() {
  const { user } = useAuth();

  return (
    <PlaceholderScreen
      greeting={`Welcome, ${user?.name}`}
      icon="dashboard"
      title="Consultant dashboard"
      phase={3}
      features={[
        'Accept or decline booking requests',
        'Upcoming sessions at a glance',
        'Earnings and rating summary',
        'Verification status banner',
      ]}
    />
  );
}

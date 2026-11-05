import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AdminUsersScreen() {
  return (
    <PlaceholderScreen
      icon="people"
      title="User management"
      phase={4}
      features={['Browse all clients and consultants', 'Suspend or reactivate accounts']}
    />
  );
}

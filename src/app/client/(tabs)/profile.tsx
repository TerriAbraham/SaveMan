import { useRouter } from 'expo-router';

import { AccountSummary } from '@/components/account-summary';
import { Button } from '@/components/ui/button';

export default function ClientProfileScreen() {
  const router = useRouter();
  return (
    <AccountSummary>
      <Button title="Edit profile" variant="secondary" onPress={() => router.push('/client/edit-profile')} />
    </AccountSummary>
  );
}

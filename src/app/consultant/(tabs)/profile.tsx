import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AccountSummary } from '@/components/account-summary';
import { LocationCard } from '@/components/location-card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

export default function ConsultantProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const openEditor = () => router.push('/consultant/edit-profile');

  return (
    <AccountSummary>
      {user?.role === 'consultant' && (
        <>
          <Button title="Edit profile" variant="secondary" onPress={openEditor} />
          <LocationCard
            location={user.location}
            name={user.name}
            action={
              <Pressable onPress={openEditor} hitSlop={8} accessibilityRole="button">
                <Text className="text-label text-red">Change</Text>
              </Pressable>
            }
          />
        </>
      )}
    </AccountSummary>
  );
}

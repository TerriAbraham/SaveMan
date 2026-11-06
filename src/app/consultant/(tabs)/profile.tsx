import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AccountSummary } from '@/components/account-summary';
import { LocationCard } from '@/components/location-card';
import { QualificationList } from '@/components/qualification-list';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

export default function ConsultantProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const openEditor = () => router.push('/consultant/edit-profile');
  const change = (
    <Pressable onPress={openEditor} hitSlop={8} accessibilityRole="button">
      <Text className="text-label text-red">Change</Text>
    </Pressable>
  );

  return (
    <AccountSummary>
      {user?.role === 'consultant' && (
        <>
          <Button title="Edit profile" variant="secondary" onPress={openEditor} />
          <View className="gap-3 rounded-card border border-line/70 bg-surface shadow-card p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-heading text-fg">Qualifications & licences</Text>
              {change}
            </View>
            <QualificationList
              qualifications={user.qualifications}
              emptyText="Add your degrees, certificates and licences so clients and SaveMan can trust your expertise."
            />
          </View>
          <LocationCard location={user.location} name={user.name} action={change} />
        </>
      )}
    </AccountSummary>
  );
}

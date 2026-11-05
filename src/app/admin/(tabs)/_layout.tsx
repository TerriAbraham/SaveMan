import { Tabs } from 'expo-router';

import { Icon } from '@/components/icon';
import { tabScreenOptions } from '@/constants/navigation';
import { useAuth } from '@/context/auth-context';

export default function AdminTabsLayout() {
  const { users } = useAuth();
  const pending = users.filter((u) => u.role === 'consultant' && u.verification === 'pending').length;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Overview', headerTitle: 'Admin overview', tabBarIcon: ({ color }) => <Icon name="dashboard" color={color} /> }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: 'Verify',
          headerTitle: 'Consultant verification',
          tabBarIcon: ({ color }) => <Icon name="verified" color={color} />,
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color }) => <Icon name="people" color={color} /> }} />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings', headerTitle: 'All bookings', tabBarIcon: ({ color }) => <Icon name="list" color={color} /> }}
      />
      <Tabs.Screen
        name="reviews"
        options={{ title: 'Reviews', headerTitle: 'Review moderation', tabBarIcon: ({ color }) => <Icon name="star" color={color} /> }}
      />
    </Tabs>
  );
}

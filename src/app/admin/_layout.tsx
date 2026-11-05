import { Tabs } from 'expo-router';

import { Icon } from '@/components/icon';
import { tabScreenOptions } from '@/constants/navigation';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Overview', headerTitle: 'Admin overview', tabBarIcon: ({ color }) => <Icon name="dashboard" color={color} /> }}
      />
      <Tabs.Screen
        name="verify"
        options={{ title: 'Verify', headerTitle: 'Consultant verification', tabBarIcon: ({ color }) => <Icon name="verified" color={color} /> }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: 'Users', tabBarIcon: ({ color }) => <Icon name="people" color={color} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings', headerTitle: 'All bookings', tabBarIcon: ({ color }) => <Icon name="list" color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }}
      />
    </Tabs>
  );
}

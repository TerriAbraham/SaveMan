import { Tabs } from 'expo-router';

import { Icon } from '@/components/icon';
import { tabScreenOptions } from '@/constants/navigation';
import { useUnreadCount } from '@/hooks/use-messages';

export default function ClientTabsLayout() {
  const unread = useUnreadCount();

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Find', headerTitle: 'Find a consultant', tabBarIcon: ({ color }) => <Icon name="search" color={color} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', headerTitle: 'Consultants near you', tabBarIcon: ({ color }) => <Icon name="map" color={color} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings', headerTitle: 'My bookings', tabBarIcon: ({ color }) => <Icon name="calendar" color={color} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <Icon name="chat" color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', headerTitle: 'My profile', tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }}
      />
    </Tabs>
  );
}

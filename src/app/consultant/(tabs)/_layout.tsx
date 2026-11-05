import { Tabs } from 'expo-router';

import { Icon } from '@/components/icon';
import { tabScreenOptions } from '@/constants/navigation';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import { useUnreadCount } from '@/hooks/use-messages';

export default function ConsultantTabsLayout() {
  const { user } = useAuth();
  const { bookings } = useData();
  const unread = useUnreadCount();
  const requests = bookings.filter((b) => b.consultantId === user?.id && b.status === 'pending').length;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Icon name="dashboard" color={color} />,
          tabBarBadge: requests > 0 ? requests : undefined,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{ title: 'Services', headerTitle: 'My services', tabBarIcon: ({ color }) => <Icon name="briefcase" color={color} /> }}
      />
      <Tabs.Screen
        name="availability"
        options={{ title: 'Availability', headerTitle: 'My availability', tabBarIcon: ({ color }) => <Icon name="clock" color={color} /> }}
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

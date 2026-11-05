import { Tabs } from 'expo-router';

import { Icon } from '@/components/icon';
import { tabScreenOptions } from '@/constants/navigation';
import { useUnreadCount } from '@/hooks/use-messages';

export default function ConsultantTabsLayout() {
  const unread = useUnreadCount();

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Icon name="dashboard" color={color} /> }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Schedule', headerTitle: 'My schedule', tabBarIcon: ({ color }) => <Icon name="clock" color={color} /> }}
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

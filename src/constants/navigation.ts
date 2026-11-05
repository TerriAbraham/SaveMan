import { colors } from './theme';

// Shared look for every role's tab navigator.
export const tabScreenOptions = {
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: colors.textOnDark,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  tabBarActiveTintColor: colors.red,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  tabBarLabelStyle: { fontWeight: '600' as const },
  sceneStyle: { backgroundColor: colors.sand },
};

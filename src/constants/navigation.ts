import { createElement } from 'react';

import { HeroTexture } from '@/components/brand';

import { colors } from './theme';

// Shared look for every role's tab navigator: textured brand header, clean white tab bar.
export const tabScreenOptions = {
  headerBackground: () => createElement(HeroTexture),
  headerTintColor: colors.textOnDark,
  headerTitleStyle: { fontWeight: '800' as const, fontSize: 19 },
  headerShadowVisible: false,
  tabBarActiveTintColor: colors.red,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  tabBarLabelStyle: { fontWeight: '700' as const, fontSize: 11 },
  sceneStyle: { backgroundColor: colors.sand },
};

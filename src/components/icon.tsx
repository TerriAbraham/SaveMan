import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type SymbolName = Extract<ComponentProps<typeof SymbolView>['name'], object>;

// SF Symbols on iOS, Material Symbols on Android and web.
const icons = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  chat: { ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  people: { ios: 'person.2.fill', android: 'group', web: 'group' },
  dashboard: { ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  verified: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  list: { ios: 'list.bullet.rectangle', android: 'event_note', web: 'event_note' },
  map: { ios: 'map.fill', android: 'map', web: 'map' },
  mail: { ios: 'envelope.fill', android: 'mail', web: 'mail' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  phone: { ios: 'phone.fill', android: 'call', web: 'call' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  briefcase: { ios: 'briefcase.fill', android: 'work', web: 'work' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  hourglass: { ios: 'hourglass', android: 'hourglass_top', web: 'hourglass_top' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <SymbolView name={icons[name]} size={size} tintColor={color} />;
}

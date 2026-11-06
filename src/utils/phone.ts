import { Alert, Linking } from 'react-native';

/** A `tel:` link for a number written like "+675 7456 1122" (keeps the leading + and digits only). */
export function telUrl(phone: string) {
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${phone.replace(/\D/g, '')}`;
}

/** Opens the phone's dialer with the number filled in. Simulators and tablets without a dialer get an alert instead. */
export async function callPhone(name: string, phone: string) {
  try {
    await Linking.openURL(telUrl(phone));
  } catch {
    Alert.alert(`Call ${name}`, `This device can’t make calls. The number is ${phone}.`);
  }
}

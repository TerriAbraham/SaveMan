import { SecuritySettings } from '@/components/security-settings';

export default function ClientSecurityScreen() {
  return <SecuritySettings fallbackHref="/client/profile" />;
}

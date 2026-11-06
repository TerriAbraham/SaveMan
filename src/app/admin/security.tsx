import { SecuritySettings } from '@/components/security-settings';

export default function AdminSecurityScreen() {
  return <SecuritySettings fallbackHref="/admin" />;
}

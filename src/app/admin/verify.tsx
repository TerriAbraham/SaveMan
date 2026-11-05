import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AdminVerifyScreen() {
  return (
    <PlaceholderScreen
      icon="verified"
      title="Verification queue"
      phase={4}
      features={['Review new consultant applications', 'Approve or reject with a reason']}
    />
  );
}

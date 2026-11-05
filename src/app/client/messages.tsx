import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ClientMessagesScreen() {
  return (
    <PlaceholderScreen
      icon="chat"
      title="Messages"
      phase={2}
      features={['Conversations with your consultants', 'Start a chat from any consultant profile']}
    />
  );
}

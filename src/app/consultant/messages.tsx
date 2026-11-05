import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ConsultantMessagesScreen() {
  return (
    <PlaceholderScreen
      icon="chat"
      title="Messages"
      phase={3}
      features={['Reply to client questions', 'Conversations linked to bookings']}
    />
  );
}

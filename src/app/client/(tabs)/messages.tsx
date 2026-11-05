import { useRouter } from 'expo-router';

import { ConversationList } from '@/components/conversation-list';

export default function ClientMessagesScreen() {
  const router = useRouter();
  return (
    <ConversationList
      onOpen={(consultantId) => router.push({ pathname: '/client/chat/[id]', params: { id: consultantId } })}
      emptyText="Open a consultant's profile and tap Message to ask a question."
    />
  );
}

import { useRouter } from 'expo-router';

import { ConversationList } from '@/components/conversation-list';

export default function ConsultantMessagesScreen() {
  const router = useRouter();
  return (
    <ConversationList
      onOpen={(clientId) => router.push({ pathname: '/consultant/chat/[id]', params: { id: clientId } })}
      emptyText="When a client sends you a message it will appear here."
    />
  );
}

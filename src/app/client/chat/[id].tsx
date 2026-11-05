import { useLocalSearchParams } from 'expo-router';

import { ChatThread } from '@/components/chat-thread';

/** Chat with a consultant; `id` is the consultant's user id. */
export default function ClientChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatThread otherId={id} fallbackHref="/client/messages" />;
}

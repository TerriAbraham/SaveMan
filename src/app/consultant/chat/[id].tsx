import { useLocalSearchParams } from 'expo-router';

import { ChatThread } from '@/components/chat-thread';

/** Chat with a client; `id` is the client's user id. */
export default function ConsultantChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatThread otherId={id} fallbackHref="/consultant/messages" />;
}

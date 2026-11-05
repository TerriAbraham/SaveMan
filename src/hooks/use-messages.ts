import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Message, User } from '@/data/types';

export interface ConversationSummary {
  conversationId: string;
  other: User;
  lastMessage: Message;
  unread: number;
}

/** The signed-in user's conversations that have at least one message, newest first. */
export function useConversations(): ConversationSummary[] {
  const { user, users } = useAuth();
  const { conversations, messages } = useData();
  if (!user) return [];

  return conversations
    .filter((c) => c.clientId === user.id || c.consultantId === user.id)
    .flatMap((c) => {
      const thread = messages.filter((m) => m.conversationId === c.id);
      const other = users.find((u) => u.id === (c.clientId === user.id ? c.consultantId : c.clientId));
      if (thread.length === 0 || !other) return [];
      const lastMessage = thread.reduce((a, b) => (b.sentAt > a.sentAt ? b : a));
      const unread = thread.filter((m) => m.senderId !== user.id && !m.read).length;
      return [{ conversationId: c.id, other, lastMessage, unread }];
    })
    .sort((a, b) => b.lastMessage.sentAt.localeCompare(a.lastMessage.sentAt));
}

export function useUnreadCount() {
  return useConversations().reduce((sum, c) => sum + c.unread, 0);
}

/** Messages between the signed-in user and `otherId`, oldest first. */
export function useThread(otherId: string) {
  const { user } = useAuth();
  const { conversations, messages } = useData();
  const conversation = conversations.find(
    (c) => (c.clientId === user?.id && c.consultantId === otherId) || (c.consultantId === user?.id && c.clientId === otherId),
  );
  const thread = conversation
    ? messages.filter((m) => m.conversationId === conversation.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    : [];
  return { conversation, messages: thread };
}

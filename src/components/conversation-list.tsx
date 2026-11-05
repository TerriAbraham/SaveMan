import { FlatList, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/context/auth-context';
import { useConversations } from '@/hooks/use-messages';
import { formatMessageTime } from '@/utils/format';

/** Inbox for either role. `onOpen` receives the other person's user id. */
export function ConversationList({ onOpen, emptyText }: { onOpen: (otherId: string) => void; emptyText: string }) {
  const { user } = useAuth();
  const conversations = useConversations();

  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.conversationId}
      contentContainerClassName="p-4 pb-8"
      ItemSeparatorComponent={() => <View className="h-2" />}
      renderItem={({ item }) => {
        const fromMe = item.lastMessage.senderId === user?.id;
        const unread = item.unread > 0;
        const subtitle = item.other.role === 'consultant' ? item.other.title : 'Client';
        return (
          <Pressable
            onPress={() => onOpen(item.other.id)}
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${item.other.name}${unread ? `, ${item.unread} unread` : ''}`}
            className="flex-row items-center gap-3 rounded-card border border-line bg-surface p-3 active:opacity-85">
            <Avatar name={item.other.name} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="shrink text-[15px] font-bold text-fg" numberOfLines={1}>
                  {item.other.name}
                </Text>
                <Text className={`text-caption ${unread ? 'font-bold text-red' : 'text-fg-muted'}`}>
                  {formatMessageTime(item.lastMessage.sentAt)}
                </Text>
              </View>
              <Text className="text-caption text-fg-muted" numberOfLines={1}>
                {subtitle}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className={`flex-1 text-body ${unread ? 'font-semibold text-fg' : 'text-fg-muted'}`} numberOfLines={1}>
                  {fromMe ? 'You: ' : ''}
                  {item.lastMessage.text}
                </Text>
                {unread && (
                  <View className="min-w-[20px] items-center rounded-full bg-red px-1.5 py-0.5">
                    <Text className="text-caption font-bold text-on-dark">{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <EmptyState icon="chat" title="No messages yet" message={emptyText} />
      }
    />
  );
}

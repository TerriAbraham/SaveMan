import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ScreenHeader } from '@/components/screen-header';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Message } from '@/data/types';
import { useThread } from '@/hooks/use-messages';
import { formatTime } from '@/utils/dates';
import { formatDayHeading } from '@/utils/format';

type Row = { kind: 'day'; key: string; date: string } | { kind: 'message'; key: string; message: Message };

/** A one-to-one chat between a client and a consultant, from either side. */
export function ChatThread({ otherId, fallbackHref }: { otherId: string; fallbackHref: Href }) {
  const insets = useSafeAreaInsets();
  const { user, users } = useAuth();
  const { sendMessage, markConversationRead } = useData();
  const { conversation, messages } = useThread(otherId);
  const [draft, setDraft] = useState('');

  const other = users.find((u) => u.id === otherId);
  const conversationId = conversation?.id;
  const userId = user?.id;

  // Opening the thread (or receiving a message while it is open) marks it read.
  useEffect(() => {
    if (conversationId && userId) markConversationRead(conversationId, userId);
  }, [conversationId, userId, messages.length, markConversationRead]);

  // Clients can only message consultants and vice versa.
  const validPair =
    user && other && ((user.role === 'client' && other.role === 'consultant') || (user.role === 'consultant' && other.role === 'client'));

  if (!validPair) {
    return (
      <View className="flex-1 bg-sand">
        <ScreenHeader title="Messages" fallbackHref={fallbackHref} />
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-body text-fg-muted">This conversation is not available.</Text>
        </View>
      </View>
    );
  }

  // Build rows oldest-first with a heading at each new day, then reverse for the inverted list.
  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const day = m.sentAt.slice(0, 10);
    if (i === 0 || messages[i - 1].sentAt.slice(0, 10) !== day) rows.push({ kind: 'day', key: `day-${day}`, date: day });
    rows.push({ kind: 'message', key: m.id, message: m });
  });
  rows.reverse();

  const canSend = draft.trim().length > 0;

  function send() {
    if (!canSend || !user || !other) return;
    const clientId = user.role === 'client' ? user.id : other.id;
    const consultantId = user.role === 'consultant' ? user.id : other.id;
    sendMessage({ clientId, consultantId, senderId: user.id, text: draft });
    setDraft('');
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-sand" behavior="padding">
      <ScreenHeader
        title={other.name}
        subtitle={other.role === 'consultant' ? other.title : 'SaveMan client'}
        leading={<Avatar name={other.name} size="sm" />}
        fallbackHref={fallbackHref}
      />

      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 p-6">
          <Icon name="chat" size={28} color={colors.textMuted} />
          <Text className="text-heading text-fg">Start the conversation</Text>
          <Text className="text-center text-body text-fg-muted">
            {other.role === 'consultant'
              ? `Ask ${other.name} a question before or after your session.`
              : `Send ${other.name} a message.`}
          </Text>
        </View>
      ) : (
        // Inverted so the newest message sits at the bottom and the list opens scrolled to it.
        <FlatList
          data={rows}
          inverted
          keyExtractor={(r) => r.key}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 px-4 py-4"
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <Text className="my-2 self-center rounded-full bg-surface px-3 py-1 text-caption text-fg-muted">
                {formatDayHeading(item.date)}
              </Text>
            ) : (
              <Bubble message={item.message} mine={item.message.senderId === user.id} />
            )
          }
        />
      )}

      <View
        className="flex-row items-end gap-2 border-t border-line bg-surface px-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          accessibilityLabel="Message"
          className="max-h-[120px] min-h-[44px] flex-1 rounded-[22px] border-[1.5px] border-line bg-sand px-4 py-2.5 text-[16px] text-fg"
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          className={`h-11 w-11 items-center justify-center rounded-full ${canSend ? 'bg-red' : 'bg-line'}`}>
          <Icon name="send" size={20} color={canSend ? colors.textOnDark : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <View className={`max-w-[80%] gap-0.5 rounded-card px-3.5 py-2.5 ${mine ? 'self-end rounded-br-md bg-red' : 'self-start rounded-bl-md border border-line bg-surface'}`}>
      <Text className={`text-body leading-[21px] ${mine ? 'text-on-dark' : 'text-fg'}`}>{message.text}</Text>
      <Text className={`self-end text-[11px] ${mine ? 'text-on-dark-muted' : 'text-fg-muted'}`}>
        {formatTime(message.sentAt.slice(11, 16))}
      </Text>
    </View>
  );
}

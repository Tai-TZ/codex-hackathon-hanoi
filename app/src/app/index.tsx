import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { type BackendStatus, useBackendStatus } from '@/hooks/use-backend-status';
import { useChat } from '@/hooks/use-chat';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useTheme } from '@/hooks/use-theme';
import { API_BASE } from '@/lib/api';
import type { Message } from '@/types/chat';

const ACCENT = '#208AEF';

const STATUS_LABEL: Record<BackendStatus, string> = {
  checking: 'Đang kiểm tra backend…',
  ready: 'Backend sẵn sàng',
  'no-api-key': 'Backend chưa có API key cho model',
  unreachable: `Không kết nối được ${API_BASE}`,
};

function MessageBubble({ message }: { message: Message }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: isUser ? ACCENT : theme.backgroundElement },
        ]}>
        <ThemedText style={isUser && styles.userText}>{message.content}</ThemedText>
        {!!message.toolsUsed?.length && (
          <ThemedText type="code" themeColor="textSecondary">
            tool: {message.toolsUsed.join(', ')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const theme = useTheme();
  const status = useBackendStatus();
  const { messages, loading, error, send } = useChat();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  // Khi bàn phím mở thì không cần chừa vùng an toàn phía dưới nữa.
  const inputBottomPadding = (keyboardVisible ? 0 : insets.bottom) + Spacing.two;

  const canSend = draft.trim().length > 0 && !loading;

  const submit = () => {
    if (!canSend) return;
    send(draft);
    setDraft('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Agent</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {STATUS_LABEL[status]}
            </ThemedText>
          </View>

          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                Gửi một tin nhắn để thử agent.
              </ThemedText>
            }
            ListFooterComponent={loading ? <ActivityIndicator style={styles.loading} /> : undefined}
          />

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <View style={[styles.inputRow, { paddingBottom: inputBottomPadding }]}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
              value={draft}
              onChangeText={setDraft}
              placeholder="Nhập tin nhắn"
              placeholderTextColor={theme.textSecondary}
              multiline
              accessibilityLabel="Tin nhắn"
            />
            <Pressable
              onPress={submit}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Gửi tin nhắn"
              style={({ pressed }) => [
                styles.sendButton,
                (!canSend || pressed) && styles.sendButtonDimmed,
              ]}>
              <ThemedText type="smallBold" style={styles.userText}>
                Gửi
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  loading: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  userText: {
    color: '#ffffff',
  },
  error: {
    color: '#D93025',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    fontSize: 16,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDimmed: {
    opacity: 0.5,
  },
});

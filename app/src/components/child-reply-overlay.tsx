import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Card, Txt } from '@/components/ui';
import { FAMILY_ID } from '@/constants/family';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { getReplies } from '@/lib/api';
import { LAST_REPLY_KEY } from '@/lib/role';
import { say, stopSpeaking } from '@/lib/speak';
import type { ChildReply } from '@/types/hoicon';

const POLL_MS = 3000;

function spoken(reply: ChildReply): string {
  return `Con ${reply.from_name} vừa trả lời: ${reply.text}`;
}

/**
 * Hỏi backend vài giây một lần; con vừa trả lời thì hiện thẻ nổi trên mọi màn hình
 * của vai Bố mẹ, rung và đọc to (F29).
 */
export function ChildReplyOverlay() {
  const insets = useSafeAreaInsets();
  const [reply, setReply] = useState<ChildReply | null>(null);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let lastId: number | null = null;

    async function tick() {
      if (busy || cancelled) return;
      busy = true;
      try {
        let fresh: ChildReply[];
        if (lastId === null) {
          const stored = await AsyncStorage.getItem(LAST_REPLY_KEY);
          const all = await getReplies(FAMILY_ID, 0);
          const maxId = all.reduce((max, r) => Math.max(max, r.id), 0);
          // Lần đầu (hoặc backend vừa xoá dữ liệu): lấy mốc hiện tại, không đọc lại câu cũ.
          lastId = stored === null || Number(stored) > maxId ? maxId : Number(stored);
          const baseline = lastId;
          fresh = all.filter((r) => r.id > baseline);
        } else {
          fresh = await getReplies(FAMILY_ID, lastId);
        }
        if (cancelled) return;
        if (fresh.length) {
          fresh.sort((a, b) => a.id - b.id);
          lastId = fresh[fresh.length - 1].id;
          setReply(fresh[fresh.length - 1]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          say(fresh.map(spoken).join('. '));
        }
        await AsyncStorage.setItem(LAST_REPLY_KEY, String(lastId));
      } catch {
        // Mất mạng tạm thời: lần hỏi sau thử lại.
      } finally {
        busy = false;
      }
    }

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!reply) return null;

  return (
    <View style={[styles.backdrop, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four }]}>
      <Card color={Colors.primarySoft} shadow={Colors.coral} style={styles.card}>
        <View style={styles.head}>
          <SonAvatar size={96} mood="idle" />
          <Txt size={FontSize.parentLarge} weight="bold" color={Colors.primary} style={styles.headText}>
            Con {reply.from_name} vừa trả lời:
          </Txt>
        </View>
        <Txt size={32} weight="bold">
          “{reply.text}”
        </Txt>
        <BigButton label="Nghe lại" icon="speaker.wave.2.fill" height={84} onPress={() => say(spoken(reply))} />
        <BigButton
          label="Đóng"
          tone="paper"
          height={72}
          onPress={() => {
            stopSpeaking();
            setReply(null);
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: { padding: Spacing.four, gap: Spacing.four },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headText: { flex: 1 },
});

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, Card, Txt } from '@/components/ui';
import { CHILD_NAME, FAMILY_ID, PARENT_NAME, PARENT_PHONE } from '@/constants/family';
import { Colors, FontSize, Radius, RiskTheme, Spacing } from '@/constants/theme';
import { getEvents, imageUrl, postReply } from '@/lib/api';
import { clearRole } from '@/lib/role';
import { call } from '@/lib/speak';
import type { AskEvent } from '@/types/hoicon';

const POLL_MS = 4000;
const QUICK_REPLIES = ['Con ổn, mẹ đừng chuyển tiền', 'Mẹ chờ con gọi ngay'];
const KIND_LABEL: Record<AskEvent['kind'], string> = {
  scam: 'Lừa đảo',
  prescription: 'Đơn thuốc',
  document: 'Giấy tờ',
  emergency: 'Khẩn cấp',
  other: 'Câu hỏi',
};

type Tab = 'urgent' | 'all';

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export default function ChildScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('urgent');
  const [events, setEvents] = useState<AskEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // event_id -> câu đã gửi cho mẹ (hoặc lỗi khi gửi).
  const [sent, setSent] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let knownRed: Set<string> | null = null;

    async function tick() {
      try {
        const list = await getEvents(FAMILY_ID);
        if (cancelled) return;
        const red = list.filter((e) => e.risk === 'red').map((e) => e.id);
        // Rung khi có cảnh báo Đỏ mới (không rung cho các cảnh báo đã có lúc mở app).
        if (knownRed && red.some((id) => !knownRed!.has(id))) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        }
        knownRed = new Set(red);
        setEvents(list);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chưa tải được dữ liệu.');
      }
    }

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const reply = (event: AskEvent, text: string) => {
    setSendError(null);
    setSent((prev) => ({ ...prev, [event.id]: text }));
    postReply({ familyId: FAMILY_ID, eventId: event.id, text, fromName: CHILD_NAME }).catch((e: unknown) => {
      setSent((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
      setSendError(e instanceof Error ? e.message : 'Chưa gửi được, thử lại nhé.');
    });
  };

  const resetRole = () => {
    clearRole()
      .catch(() => undefined)
      .then(() => router.replace('/'));
  };

  const urgent = (events ?? []).filter((e) => e.risk !== 'green');
  const shown = tab === 'urgent' ? urgent : (events ?? []);
  const redCount = urgent.filter((e) => e.risk === 'red' && !sent[e.id]).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {/* Giữ lâu vào tiêu đề để đổi vai (dùng khi demo). */}
      <Pressable onLongPress={resetRole} delayLongPress={1500} style={styles.header}>
        <View>
          <Txt size={FontSize.heading} weight="bold">
            Hỏi Con
          </Txt>
          <Txt size={FontSize.small} color={Colors.textMuted}>
            {CHILD_NAME} đang theo dõi {PARENT_NAME}
          </Txt>
        </View>
        <BigButton label="Gọi mẹ" icon="phone.fill" tone="paper" height={48} fontSize={FontSize.body} onPress={() => call(PARENT_PHONE)} />
      </Pressable>

      <View style={styles.tabs}>
        <TabButton label={redCount ? `Khẩn cấp (${redCount})` : 'Khẩn cấp'} active={tab === 'urgent'} onPress={() => setTab('urgent')} />
        <TabButton label="Mẹ đã hỏi" active={tab === 'all'} onPress={() => setTab('all')} />
      </View>

      {(error || sendError) && (
        <Txt size={FontSize.small} color={Colors.dangerText} style={styles.notice}>
          {sendError ?? error}
        </Txt>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {events === null && !error && <Txt color={Colors.textMuted}>Đang tải…</Txt>}
        {events !== null && shown.length === 0 && (
          <Card>
            <Txt weight="bold">{tab === 'urgent' ? 'Chưa có cảnh báo nào' : 'Mẹ chưa hỏi gì'}</Txt>
            <Txt color={Colors.textMuted}>
              {tab === 'urgent'
                ? 'Khi mẹ gặp tin nhắn lừa đảo hay việc cần chú ý, cảnh báo sẽ hiện ở đây.'
                : 'Mọi câu hỏi và ảnh mẹ gửi sẽ hiện ở đây.'}
            </Txt>
          </Card>
        )}
        {shown.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            withReplies={tab === 'urgent'}
            sentText={sent[event.id]}
            onReply={(text) => reply(event, text)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.tab, active && styles.tabActive]}>
      <Txt weight="bold" color={active ? Colors.white : Colors.text} center>
        {label}
      </Txt>
    </Pressable>
  );
}

function EventCard({
  event,
  withReplies,
  sentText,
  onReply,
}: {
  event: AskEvent;
  withReplies: boolean;
  sentText?: string;
  onReply: (text: string) => void;
}) {
  const risk = RiskTheme[event.risk];
  const photo = imageUrl(event.image_url);
  return (
    <Card color={event.risk === 'green' ? Colors.surface : risk.soft} shadow={risk.solid}>
      <View style={styles.cardHead}>
        <View style={[styles.badge, { backgroundColor: risk.solid }]}>
          <Txt size={FontSize.small} weight="bold" color={Colors.white}>
            {risk.label}
          </Txt>
        </View>
        <Txt size={FontSize.small} color={Colors.textMuted}>
          {KIND_LABEL[event.kind] ?? 'Câu hỏi'} · {timeLabel(event.created_at)}
        </Txt>
      </View>
      <Txt size={20} weight="bold" color={risk.text}>
        {event.title}
      </Txt>
      {!!event.question_text && (
        <Txt color={Colors.textMuted}>
          {PARENT_NAME} hỏi: “{event.question_text}”
        </Txt>
      )}
      {photo && <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />}
      <Txt>{event.answer}</Txt>
      {event.actions.length > 0 && (
        <Txt size={FontSize.small} color={Colors.textMuted}>
          Đã khuyên mẹ: {event.actions.join(' · ')}
        </Txt>
      )}
      <Txt size={FontSize.small} color={Colors.textMuted}>
        Độ chắc chắn {Math.round(event.confidence * 100)}%
        {event.family_notified ? ' · Đã báo qua Telegram' : ''}
      </Txt>

      {withReplies &&
        (sentText ? (
          <View style={styles.sent}>
            <Txt weight="bold" color={Colors.primary}>
              ✓ Đã gửi cho mẹ: “{sentText}”
            </Txt>
            <Txt size={FontSize.small} color={Colors.textMuted}>
              Máy của mẹ sẽ đọc to câu này.
            </Txt>
          </View>
        ) : (
          <View style={styles.replies}>
            {QUICK_REPLIES.map((text, index) => (
              <BigButton
                key={text}
                label={text}
                tone={index === 0 ? 'primary' : 'paper'}
                height={56}
                fontSize={FontSize.body}
                onPress={() => onReply(text)}
              />
            ))}
          </View>
        ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two },
  tabs: { flexDirection: 'row', gap: Spacing.two, marginVertical: Spacing.two },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.primary },
  notice: { marginBottom: Spacing.two },
  list: { gap: Spacing.three, paddingBottom: Spacing.six, paddingRight: Spacing.one },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.pill },
  photo: { width: '100%', height: 220, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.text },
  replies: { gap: Spacing.two, marginTop: Spacing.two },
  sent: { marginTop: Spacing.two, gap: Spacing.half },
});

import * as Haptics from 'expo-haptics';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BigButton, Card, Txt } from '@/components/ui';
import { CHILD_NAME } from '@/constants/family';
import { Colors, FontSize, Radius, RiskTheme, Spacing } from '@/constants/theme';
import { confirmPrescription } from '@/lib/api';
import { say } from '@/lib/speak';
import type { AskEvent, ConfirmResponse, Prescription } from '@/types/hoicon';

function spokenText(event: AskEvent): string {
  // Việc cần làm đọc trước phần giải thích: đó là thứ mẹ cần nghe đầu tiên.
  const parts = [event.risk === 'red' ? `Mẹ ơi, nguy hiểm. ${event.title}` : event.title];
  if (event.actions.length) parts.push(`Mẹ nhớ: ${event.actions.join('. ')}`);
  parts.push(event.answer);
  if (event.family_notified) parts.push(`Con ${CHILD_NAME} đã được báo`);
  return parts.join('. ');
}

export function ResultView({
  event,
  onDone,
  onAskMore,
  onCall,
}: {
  event: AskEvent;
  onDone: () => void;
  onAskMore: () => void;
  onCall: () => void;
}) {
  const risk = RiskTheme[event.risk];
  const isRed = event.risk === 'red';
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const metrics = useRef({ content: 0, viewport: 0, y: 0 });
  // Còn nội dung bên dưới chưa thấy: hiện nút "Đọc tiếp" vì nhiều người lớn tuổi không biết kéo màn hình.
  const [hasMore, setHasMore] = useState(false);
  const refreshMore = () => {
    const m = metrics.current;
    setHasMore(m.content - m.viewport - m.y > 24);
  };

  useEffect(() => {
    if (event.risk === 'red') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    }
    say(spokenText(event));
  }, [event]);

  return (
    <View style={styles.root}>
      <View style={styles.scrollArea}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator
          scrollEventThrottle={64}
          onLayout={(e) => {
            metrics.current.viewport = e.nativeEvent.layout.height;
            refreshMore();
          }}
          onContentSizeChange={(_, height) => {
            metrics.current.content = height;
            refreshMore();
          }}
          onScroll={(e) => {
            metrics.current.y = e.nativeEvent.contentOffset.y;
            refreshMore();
          }}>
          <Card color={risk.soft} shadow={risk.solid} style={styles.mainCard}>
            <View style={[styles.badge, { backgroundColor: risk.solid }]}>
              <Txt size={FontSize.parentBody} weight="bold" color={Colors.white}>
                {isRed ? '⚠ ' : ''}
                {risk.label}
              </Txt>
            </View>
            <Txt size={30} weight="bold" color={risk.text}>
              {event.title}
            </Txt>
            {/* Việc cần làm đặt ngay dưới kết luận để không bị khuất. */}
            {event.actions.map((action) => (
              <View key={action} style={styles.action}>
                <View style={[styles.dot, { backgroundColor: risk.solid }]} />
                <Txt size={FontSize.parentLarge} weight="bold" style={styles.actionText}>
                  {action}
                </Txt>
              </View>
            ))}
          </Card>

          {event.family_notified && (
            <Card color={Colors.primarySoft} shadow={Colors.coral}>
              <Txt size={FontSize.parentBody} weight="bold" color={Colors.primary}>
                ✓ Con {CHILD_NAME} đã được báo. Mẹ chờ con trả lời nhé.
              </Txt>
            </Card>
          )}

          <Card>
            <Txt size={FontSize.parentLarge}>{event.answer}</Txt>
          </Card>

          {event.prescription && <PrescriptionBlock eventId={event.id} prescription={event.prescription} />}
        </ScrollView>
        {hasMore && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đọc tiếp"
            style={styles.more}
            onPress={() => scroll.current?.scrollTo({ y: metrics.current.y + metrics.current.viewport * 0.75, animated: true })}>
            <Txt size={FontSize.parentBody} weight="bold" color={Colors.white}>
              ▼ Còn nữa, bấm để đọc tiếp
            </Txt>
          </Pressable>
        )}
      </View>

      <View style={styles.buttons}>
        <BigButton
          label={`Gọi con ${CHILD_NAME}`}
          icon="phone.fill"
          tone={isRed ? 'danger' : 'paper'}
          height={isRed ? 100 : 76}
          fontSize={isRed ? 30 : FontSize.parentBody}
          onPress={onCall}
        />
        <View style={styles.row}>
          <BigButton label="Nghe lại" icon="speaker.wave.2.fill" tone="paper" vertical height={88} fontSize={20} style={styles.third} onPress={() => say(spokenText(event))} />
          <BigButton label="Hỏi thêm" icon="mic.fill" tone="coral" vertical height={88} fontSize={20} style={styles.third} onPress={onAskMore} />
          <BigButton label="Xong" icon="checkmark" vertical height={88} fontSize={20} style={styles.third} onPress={onDone} />
        </View>
      </View>
    </View>
  );
}

/** Đơn thuốc: hiện danh sách đọc được, hỏi lại từng chỗ chưa chắc bằng hai nút, rồi hiện lịch uống. */
function PrescriptionBlock({ eventId, prescription }: { eventId: string; prescription: Prescription }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const questions = prescription.questions;
  const current = questions.find((q) => !(q.id in answers));

  const submit = (all: Record<string, string>) => {
    setSending(true);
    setError(null);
    confirmPrescription(eventId, all)
      .then((res) => {
        setResult(res);
        const lines = res.schedule.map((s) => `${s.drug}, ${s.dose}, uống lúc ${s.times.join(', ')}`);
        say(`Lịch uống thuốc của mẹ. ${lines.join('. ')}`);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Chưa lưu được lịch, mẹ thử lại nhé.'))
      .finally(() => setSending(false));
  };

  const answer = (questionId: string, value: string) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    const upcoming = questions.find((q) => !(q.id in next));
    if (upcoming) say(upcoming.text);
    else submit(next);
  };

  return (
    <Card>
      <Txt size={FontSize.parentLarge} weight="bold">
        Thuốc con đọc được
      </Txt>
      {prescription.items.map((item, index) => (
        <View key={`${item.drug}-${index}`} style={styles.drug}>
          <Txt size={FontSize.parentBody} weight="bold">
            {item.drug} {item.dose}
          </Txt>
          <Txt size={FontSize.parentBody} color={Colors.textMuted}>
            {[item.times.join(', '), item.note].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      ))}

      {!result && current && (
        <View style={styles.question}>
          <Txt size={FontSize.parentLarge} weight="bold" color={Colors.primary}>
            {current.text}
          </Txt>
          <View style={styles.row}>
            <BigButton label="Đúng" height={96} fontSize={28} style={styles.half} onPress={() => answer(current.id, 'Đúng')} />
            <BigButton label="Không phải" tone="paper" height={96} fontSize={24} style={styles.half} onPress={() => answer(current.id, 'Không phải')} />
          </View>
        </View>
      )}
      {!result && !current && !sending && !error && questions.length === 0 && (
        <BigButton label="Lập lịch uống" height={84} onPress={() => submit({})} />
      )}
      {sending && (
        <Txt size={FontSize.parentBody} color={Colors.textMuted}>
          Con đang lập lịch uống…
        </Txt>
      )}
      {error && (
        <View style={styles.question}>
          <Txt size={FontSize.parentBody} color={Colors.dangerText}>
            {error}
          </Txt>
          <BigButton label="Thử lại" tone="paper" height={76} onPress={() => submit(answers)} />
        </View>
      )}

      {result && (
        <View style={styles.question}>
          <Txt size={FontSize.parentLarge} weight="bold" color={Colors.primary}>
            Lịch uống thuốc
          </Txt>
          {result.schedule.map((item, index) => (
            <Txt key={`${item.drug}-${index}`} size={FontSize.parentBody} weight="semibold">
              {item.times.join(', ')} — {item.drug} {item.dose}
            </Txt>
          ))}
          {result.needs_child.length > 0 && (
            <Txt size={FontSize.parentBody} color={Colors.warnText}>
              Mấy chỗ này mẹ để con {CHILD_NAME} xem giúp nhé: {result.needs_child.join('; ')}
            </Txt>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: Spacing.three },
  scrollArea: { flex: 1 },
  // Thanh ngang che phần thẻ bị cắt dở, để chữ không chồng lên nhau.
  more: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.card,
    borderWidth: 2,
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
  third: { flex: 1 },
  scroll: { gap: Spacing.three, paddingBottom: Spacing.six, paddingRight: Spacing.one },
  mainCard: { padding: Spacing.three, gap: Spacing.three },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Radius.pill },
  action: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 11 },
  actionText: { flex: 1 },
  buttons: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
  drug: { gap: Spacing.half },
  question: { gap: Spacing.three, marginTop: Spacing.two },
});

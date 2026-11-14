import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Card, Txt } from '@/components/ui';
import { PARENT_NAME } from '@/constants/family';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { spokenReply, useLastReply } from '@/lib/last-reply';
import { say } from '@/lib/speak';

// Chỉ chào bằng giọng nói một lần mỗi lần mở app, không lặp lại khi quay về màn hình chính.
let greeted = false;

/** Màn hình chính theo bản mẫu đã chốt: dòng trạng thái nhỏ, nhân vật ở giữa, câu gợi ý nhạt, nút bo tròn. */
export function ParentHome({
  onCamera,
  onLibrary,
  onSpeak,
  onCall,
  onResetRole,
}: {
  onCamera: () => void;
  onLibrary: () => void;
  onSpeak: () => void;
  onCall: () => void;
  onResetRole: () => void;
}) {
  const lastReply = useLastReply();

  useEffect(() => {
    if (greeted) return;
    greeted = true;
    const timer = setTimeout(() => say(`Chào ${PARENT_NAME}. Mẹ cần hỏi gì, cứ bấm nói với con nhé.`), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      {/* Giữ rất lâu vào nhân vật để đổi vai (chỉ dùng khi demo; đủ lâu để mẹ không lỡ tay). */}
      <Pressable onLongPress={onResetRole} delayLongPress={3000} style={styles.top}>
        <Txt size={FontSize.parentBody} color={Colors.hint} center>
          Bấm nói, con nghe
        </Txt>
        <SonAvatar size={260} />
        {lastReply ? (
          // Lời con nhắn gần nhất: mẹ lỡ đóng thẻ hoặc chưa nghe kịp vẫn xem lại được.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${spokenReply(lastReply)}. Bấm để nghe lại`}
            onPress={() => say(spokenReply(lastReply))}
            style={styles.replyPress}>
            <Card color={Colors.primarySoft} style={styles.replyCard}>
              <Txt size={FontSize.parentBody} weight="bold" color={Colors.primary}>
                Con nhắn mẹ lúc {formatTime(lastReply.at)}:
              </Txt>
              <Txt size={FontSize.parentLarge} weight="bold" numberOfLines={3}>
                “{lastReply.text}”
              </Txt>
              <View style={styles.replyHint}>
                <SymbolView name="speaker.wave.2.fill" size={22} tintColor={Colors.primary} />
                <Txt size={FontSize.sub} weight="semibold" color={Colors.primary}>
                  Bấm vào đây để nghe lại
                </Txt>
              </View>
            </Card>
          </Pressable>
        ) : (
          <Txt size={FontSize.heading} weight="semibold" color={Colors.hint} center>
            Mẹ cần hỏi gì cứ nói nhé
          </Txt>
        )}
      </Pressable>

      <View style={styles.buttons}>
        <BigButton label="Nói với con" icon="mic.fill" height={84} fontSize={28} onPress={onSpeak} />
        <BigButton label="Chụp ảnh cho con xem" icon="camera.fill" tone="soft" height={76} fontSize={24} onPress={onCamera} />
        <View style={styles.row}>
          <BigButton label="Gọi con" icon="phone.fill" tone="paper" height={64} fontSize={20} style={styles.half} onPress={onCall} />
          <BigButton label="Ảnh có sẵn" icon="photo.fill" tone="paper" height={64} fontSize={20} style={styles.half} onPress={onLibrary} />
        </View>
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()} giờ ${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  replyPress: { alignSelf: 'stretch' },
  replyCard: { padding: Spacing.three, gap: Spacing.one },
  replyHint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  root: { flex: 1, justifyContent: 'space-between', paddingBottom: Spacing.two },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  buttons: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
});

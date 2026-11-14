import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { CHILD_NAME, PARENT_NAME } from '@/constants/family';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { say } from '@/lib/speak';

// Chỉ chào bằng giọng nói một lần mỗi lần mở app, không lặp lại khi quay về màn hình chính.
let greeted = false;

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
  useEffect(() => {
    if (greeted) return;
    greeted = true;
    const timer = setTimeout(() => say(`Chào ${PARENT_NAME}. Mẹ cần hỏi gì, bấm Chụp ảnh hoặc bấm Nói nhé.`), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      {/* Giữ rất lâu vào lời chào để đổi vai (chỉ dùng khi demo; đủ lâu để mẹ không lỡ tay). */}
      <Pressable onLongPress={onResetRole} delayLongPress={3000} style={styles.greeting}>
        <SonAvatar size={112} />
        <View style={styles.greetingText}>
          <Txt size={FontSize.heading} weight="bold">
            Chào {PARENT_NAME}.
          </Txt>
          <Txt size={FontSize.parentBody} color={Colors.textMuted}>
            Mẹ cần hỏi gì, cứ chụp hoặc nói nhé.
          </Txt>
        </View>
      </Pressable>

      <View style={styles.buttons}>
        <BigButton
          label="Chụp ảnh"
          sub="tin nhắn lạ, đơn thuốc, giấy tờ"
          icon="camera.fill"
          height={132}
          fontSize={34}
          onPress={onCamera}
        />
        <BigButton label="Nói" sub="hỏi con bằng lời" icon="mic.fill" tone="coral" height={112} fontSize={34} onPress={onSpeak} />
        <BigButton label={`Gọi con ${CHILD_NAME}`} icon="phone.fill" tone="paper" height={88} fontSize={FontSize.parentLarge} onPress={onCall} />
        <BigButton label="Ảnh có sẵn trong máy" icon="photo.fill" tone="paper" height={72} onPress={onLibrary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingBottom: Spacing.two },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  greetingText: { flex: 1, gap: Spacing.one },
  buttons: { gap: Spacing.three },
});

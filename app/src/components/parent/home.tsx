import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { PARENT_NAME } from '@/constants/family';
import { Colors, FontSize, Spacing } from '@/constants/theme';
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
        <Txt size={FontSize.heading} weight="semibold" color={Colors.hint} center>
          Mẹ cần hỏi gì cứ nói nhé
        </Txt>
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

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', paddingBottom: Spacing.two },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  buttons: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  half: { flex: 1 },
});

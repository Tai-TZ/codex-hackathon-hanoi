import { Pressable, StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { CHILD_NAME, PARENT_NAME } from '@/constants/family';
import { Colors, FontSize, Spacing } from '@/constants/theme';

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
  return (
    <View style={styles.root}>
      {/* Giữ lâu vào lời chào để đổi vai (dùng khi demo). */}
      <Pressable onLongPress={onResetRole} delayLongPress={1500} style={styles.greeting}>
        <SonAvatar size={128} />
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
        <BigButton label="Chụp" icon="camera.fill" height={140} fontSize={36} onPress={onCamera} />
        <BigButton label="Nói" icon="mic.fill" tone="coral" height={120} fontSize={36} onPress={onSpeak} />
        <BigButton label={`Gọi con ${CHILD_NAME}`} icon="phone.fill" tone="paper" height={96} fontSize={FontSize.parentLarge} onPress={onCall} />
      </View>

      <Pressable onPress={onLibrary} style={styles.library} accessibilityRole="button">
        <Txt size={FontSize.parentBody} weight="semibold" color={Colors.primary} center style={styles.underline}>
          Chọn ảnh có sẵn trong máy
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  greetingText: { flex: 1, gap: Spacing.one },
  buttons: { gap: Spacing.four },
  library: { minHeight: 64, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { BigButton, Txt } from '@/components/ui';
import { Colors, FontSize, riso, Spacing } from '@/constants/theme';
import { say } from '@/lib/speak';

const SLOW_AFTER_MS = 15_000;

export function ProcessingView({
  imageUri,
  text,
  onCancel,
  onCall,
}: {
  imageUri?: string;
  text?: string;
  onCancel: () => void;
  onCall: () => void;
}) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true);
      say('Mạng hơi chậm, mẹ chờ con thêm chút nhé.');
    }, SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        {imageUri ? (
          <View style={[riso(Colors.teal), styles.photoFrame]}>
            <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
          </View>
        ) : (
          !!text && (
            <View style={[riso(Colors.teal), styles.quote]}>
              <Txt size={FontSize.parentLarge} weight="semibold" numberOfLines={5}>
                “{text}”
              </Txt>
            </View>
          )
        )}
        <SonAvatar size={130} mood="thinking" />
        <Txt size={FontSize.heading} weight="bold" color={Colors.primary} center>
          Con đang xem giúp mẹ…
        </Txt>
        <Txt size={FontSize.parentBody} color={Colors.textMuted} center>
          {slow ? 'Mạng hơi chậm, mẹ chờ thêm chút nhé.' : 'Mẹ chờ con một chút, không cần bấm gì.'}
        </Txt>
      </View>

      {/* Chờ lâu thì cho mẹ lối ra, không để mẹ kẹt ở màn hình chờ. */}
      {slow && (
        <View style={styles.buttons}>
          <BigButton label="Gọi con" icon="phone.fill" tone="paper" height={84} onPress={onCall} />
          <BigButton label="Thôi, quay lại" icon="arrow.uturn.left" tone="paper" height={76} onPress={onCancel} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  photoFrame: { width: '58%', aspectRatio: 3 / 4, backgroundColor: Colors.surface },
  photo: { flex: 1, borderRadius: 17 },
  quote: { alignSelf: 'stretch', padding: Spacing.four, backgroundColor: Colors.surface },
  buttons: { gap: Spacing.three },
});

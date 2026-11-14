import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { Txt } from '@/components/ui';
import { Colors, FontSize, riso, Spacing } from '@/constants/theme';

const SLOW_AFTER_MS = 20_000;

export function ProcessingView({ imageUri, text }: { imageUri?: string; text?: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      {imageUri ? (
        <View style={[riso(Colors.teal), styles.photoFrame]}>
          <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" />
        </View>
      ) : (
        !!text && (
          <View style={[riso(Colors.teal), styles.quote]}>
            <Txt size={FontSize.parentLarge} weight="semibold">
              “{text}”
            </Txt>
          </View>
        )
      )}
      <SonAvatar size={150} mood="thinking" />
      <Txt size={FontSize.heading} weight="bold" color={Colors.primary} center>
        Đang xem giúp mẹ…
      </Txt>
      <Txt size={FontSize.parentBody} color={Colors.textMuted} center>
        {slow ? 'Mạng chậm, mẹ chờ thêm chút nhé.' : 'Mẹ chờ con một chút nhé.'}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  photoFrame: { width: '70%', aspectRatio: 3 / 4, backgroundColor: Colors.surface },
  photo: { flex: 1, borderRadius: 17 },
  quote: { alignSelf: 'stretch', padding: Spacing.four, backgroundColor: Colors.surface },
});

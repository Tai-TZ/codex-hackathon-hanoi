import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { SonAvatar } from '@/components/son-avatar';
import { Txt } from '@/components/ui';
import { Colors, FontSize, Spacing } from '@/constants/theme';

/** Ba chấm nhảy lần lượt, báo cho người dùng biết app vẫn đang chạy. */
export function LoadingDots({ color = Colors.primary, size = 12 }: { color?: string; size?: number }) {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  useEffect(() => {
    const loops = dots.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - index) * 160 + 200),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel="Đang tải">
      {dots.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.8] }) }],
          }}
        />
      ))}
    </View>
  );
}

/** Màn hình chờ toàn trang: nhân vật người con, tên app hoặc một câu ngắn, ba chấm nhảy. */
export function LoadingScreen({ message, title = 'Hỏi Con' }: { message?: string; title?: string }) {
  return (
    <View style={styles.screen}>
      <SonAvatar size={200} mood="thinking" />
      <Txt size={FontSize.title} weight="bold" center>
        {title}
      </Txt>
      {!!message && (
        <Txt size={FontSize.parentBody} color={Colors.textMuted} center>
          {message}
        </Txt>
      )}
      <LoadingDots />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  dots: { flexDirection: 'row', gap: Spacing.two, height: 28, alignItems: 'flex-end' },
});

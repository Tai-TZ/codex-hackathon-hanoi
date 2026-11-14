import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

export type AvatarMood = 'idle' | 'listening' | 'thinking';

/**
 * Nhân vật người con, vẽ bằng View theo kiểu nét mực + hai màu in lệch.
 * idle: thở nhẹ. listening: tay đưa lên tai, giọt màu phồng. thinking: giọt chạy vòng.
 */
export function SonAvatar({ mood = 'idle', size = 180 }: { mood?: AvatarMood; size?: number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: mood === 'listening' ? 450 : 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: mood === 'listening' ? 450 : 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const turn = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: mood === 'thinking' ? 1800 : 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    beat.start();
    turn.start();
    return () => {
      beat.stop();
      turn.stop();
    };
  }, [mood, pulse, spin]);

  const u = size / 180;
  const blobScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, mood === 'listening' ? 1.16 : 1.05] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bob = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -3 * u] });
  const tilt = mood === 'listening' ? '5deg' : mood === 'thinking' ? '-3deg' : '0deg';

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel="Hình người con">
      {/* Giọt chất lỏng quanh ảnh */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }, { scale: blobScale }] }]}>
        <View style={[styles.blob, { backgroundColor: Colors.teal, width: 150 * u, height: 138 * u, borderRadius: 70 * u, left: 8 * u, top: 20 * u }]} />
        <View style={[styles.blob, { backgroundColor: Colors.coral, width: 64 * u, height: 58 * u, borderRadius: 30 * u, left: 112 * u, top: 6 * u }]} />
        <View style={[styles.blob, { backgroundColor: Colors.primary, width: 38 * u, height: 34 * u, borderRadius: 18 * u, left: 2 * u, top: 112 * u }]} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: bob }] }]}>
        {/* Áo: mảng màu in lệch khỏi nét */}
        <View style={[styles.fill, { backgroundColor: Colors.primary, width: 112 * u, height: 62 * u, left: 36 * u, top: 122 * u, borderTopLeftRadius: 44 * u, borderTopRightRadius: 44 * u }]} />
        <View style={[styles.ink, { width: 112 * u, height: 62 * u, left: 34 * u, top: 120 * u, borderTopLeftRadius: 44 * u, borderTopRightRadius: 44 * u, borderBottomWidth: 0 }]} />

        <View style={{ position: 'absolute', left: 48 * u, top: 30 * u, transform: [{ rotate: tilt }] }}>
          {/* Mặt */}
          <View style={[styles.fill, { backgroundColor: Colors.coralSoft, width: 84 * u, height: 92 * u, borderRadius: 40 * u, left: 2 * u, top: 2 * u }]} />
          <View style={[styles.ink, { width: 84 * u, height: 92 * u, borderRadius: 40 * u }]} />
          {/* Tóc */}
          <View style={{ position: 'absolute', backgroundColor: Colors.text, width: 88 * u, height: 34 * u, left: -2 * u, top: -6 * u, borderTopLeftRadius: 40 * u, borderTopRightRadius: 40 * u, borderBottomRightRadius: 22 * u }} />
          {/* Mắt */}
          <View style={[styles.eye, { width: 8 * u, height: mood === 'thinking' ? 4 * u : 8 * u, borderRadius: 4 * u, left: 22 * u, top: 44 * u }]} />
          <View style={[styles.eye, { width: 8 * u, height: mood === 'thinking' ? 4 * u : 8 * u, borderRadius: 4 * u, left: 54 * u, top: 44 * u }]} />
          {/* Má */}
          <View style={[styles.cheek, { width: 14 * u, height: 9 * u, borderRadius: 5 * u, left: 12 * u, top: 58 * u }]} />
          <View style={[styles.cheek, { width: 14 * u, height: 9 * u, borderRadius: 5 * u, left: 58 * u, top: 58 * u }]} />
          {/* Miệng cười */}
          <View style={{ position: 'absolute', width: 22 * u, height: 11 * u, left: 31 * u, top: 66 * u, borderBottomLeftRadius: 11 * u, borderBottomRightRadius: 11 * u, borderWidth: 2.4, borderTopWidth: 0, borderColor: Colors.text }} />
        </View>

        {/* Bàn tay khum sau tai khi đang nghe */}
        {mood === 'listening' && (
          <>
            <View style={[styles.fill, { backgroundColor: Colors.coral, width: 26 * u, height: 36 * u, borderRadius: 13 * u, left: 134 * u, top: 62 * u }]} />
            <View style={[styles.ink, { width: 26 * u, height: 36 * u, borderRadius: 13 * u, left: 132 * u, top: 60 * u, backgroundColor: Colors.coralSoft }]} />
            <View style={[styles.ink, { width: 16 * u, height: 44 * u, left: 138 * u, top: 94 * u, borderRadius: 8 * u, backgroundColor: Colors.primary, transform: [{ rotate: '-12deg' }] }]} />
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', opacity: 0.9 },
  fill: { position: 'absolute' },
  ink: { position: 'absolute', borderWidth: 2.4, borderColor: Colors.text },
  eye: { position: 'absolute', backgroundColor: Colors.text },
  cheek: { position: 'absolute', backgroundColor: Colors.coral },
});

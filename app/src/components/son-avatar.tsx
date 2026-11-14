import { Blur, Canvas, Circle, ColorMatrix, Group, Oval, Paint, Path, Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View } from 'react-native';
import { type SharedValue, useDerivedValue, useFrameCallback, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

export type AvatarMood = 'idle' | 'listening' | 'thinking';

/**
 * Nhân vật người con theo bản mẫu đã chốt (nét mực, in hai màu lệch nhẹ, giọt chất lỏng quanh ảnh).
 * idle: thở nhẹ, chớp mắt. listening: tay đưa lên tai kiểu lò xo, nghiêng đầu, giọt phồng.
 * thinking: mắt nhìn lên, giọt dồn lại chạy vòng nhanh.
 * Toạ độ giữ theo khung 250x250 của bản mẫu.
 */

const INK = Colors.text;
const SKIN = '#FFD8BE';
const SKIN_BG = '#FFE9D6';
const OFFSET = [{ translateX: 1.6 }, { translateY: 1.6 }];
// Làm mờ rồi ép ngưỡng độ trong suốt: các giọt gần nhau nhập vào nhau, viền vẫn sắc.
const GOO = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 22, -10];

const CLIP = Skia.PathBuilder.Make().addCircle(125, 125, 60).build();

// [màu, số giọt, chiều và tốc độ quay, bán kính quỹ đạo, cỡ giọt, độ dày vòng nền]
const LAYERS = [
  { color: Colors.teal, count: 5, dir: -0.35, orbit: 74, blob: 15, ring: 10 },
  { color: Colors.coral, count: 4, dir: 0.5, orbit: 76, blob: 14, ring: 0 },
  { color: Colors.primary, count: 5, dir: 0.8, orbit: 72, blob: 11, ring: 9 },
] as const;

/** Một bộ phận = mảng màu lệch (1.6, 1.6) + nét mực đúng vị trí, tạo hiệu ứng in lệch màu. */
function Part({ d, fill, open }: { d: string; fill: string; open?: boolean }) {
  return (
    <>
      <Path path={open ? `${d} Z` : d} color={fill} transform={OFFSET} />
      <Path path={d} color={INK} style="stroke" strokeWidth={2.4} strokeJoin="round" strokeCap="round" />
    </>
  );
}

function Line({ d, width = 2.4 }: { d: string; width?: number }) {
  return <Path path={d} color={INK} style="stroke" strokeWidth={width} strokeJoin="round" strokeCap="round" />;
}

export function SonAvatar({ mood = 'idle', size = 180 }: { mood?: AvatarMood; size?: number }) {
  const t = useSharedValue(0); // giây đã trôi
  const phase = useSharedValue(0); // quãng đường các giọt đã chạy
  const raise = useSharedValue(0); // tay đưa lên tai: 0..1
  const think = useSharedValue(0); // đang xem: 0..1

  useEffect(() => {
    // Lò xo: đưa tay lên thì vượt nhẹ rồi dừng, hạ xuống thì mềm hơn.
    raise.value = withSpring(mood === 'listening' ? 1 : 0, mood === 'listening' ? { stiffness: 90, damping: 13 } : { stiffness: 110, damping: 17 });
    think.value = withTiming(mood === 'thinking' ? 1 : 0, { duration: 700 });
  }, [mood, raise, think]);

  useFrameCallback((frame) => {
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    t.value += dt;
    const loud = raise.value * (0.35 + 0.65 * Math.abs(Math.sin(t.value * 7.3) * Math.sin(t.value * 3.1 + 1)));
    phase.value += dt * (1 + loud * 1.2 + think.value * 3);
  });

  const blobs0 = useLayerPath(0, t, phase, raise, think);
  const blobs1 = useLayerPath(1, t, phase, raise, think);
  const blobs2 = useLayerPath(2, t, phase, raise, think);
  const blobs = [blobs0, blobs1, blobs2];

  // Nghiêng đầu 5° về phía tay khi nghe, -3° khi suy nghĩ; nhấp nhô nhẹ như thở.
  const headTransform = useDerivedValue(() => [
    { rotate: ((raise.value * 5 - think.value * 3) * Math.PI) / 180 },
    { translateY: Math.sin(t.value * 1.6) * 0.6 },
  ]);
  const browTransform = useDerivedValue(() => [{ translateY: -1.5 * raise.value - 2 * think.value }]);

  // Chớp mắt khoảng 4 giây một lần; mắt liếc về phía tai khi nghe, nhìn lên khi xem.
  const eyeL = useDerivedValue(() => eyeRect(70, t.value, raise.value, think.value));
  const eyeR = useDerivedValue(() => eyeRect(90, t.value, raise.value, think.value));

  const forearm = useDerivedValue(() => {
    const q = Math.max(0, Math.min(1.08, raise.value));
    return Skia.PathBuilder.Make()
      .moveTo(128 + 2 * q, 162 - 50 * q)
      .lineTo(124 - 8 * q, 192 - 110 * q)
      .build();
  });
  const sleeve = useDerivedValue(() => {
    const q = Math.max(0, Math.min(1.08, raise.value));
    return Skia.PathBuilder.Make()
      .moveTo(120, 130)
      .lineTo(128 + 2 * q, 162 - 50 * q)
      .build();
  });
  const handTransform = useDerivedValue(() => {
    const q = Math.max(0, Math.min(1.08, raise.value));
    return [{ translateX: 124 - 8 * q }, { translateY: 192 - 110 * q }, { rotate: ((20 - 32 * q) * Math.PI) / 180 }];
  });
  const armOpacity = useDerivedValue(() => Math.max(0, Math.min(1, raise.value * 5)));

  const mouth = mood === 'listening' ? 'M74 79 Q80 83.5 86 79' : mood === 'thinking' ? 'M76 80 Q81 79 85 80.5' : 'M72 78 Q80 85 88 78';
  // Khung bản mẫu là 250x250, hình nằm trong vòng bán kính ~100 quanh tâm (125, 125).
  const scale = size / 200;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel="Hình người con">
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale }, { translateX: -25 }, { translateY: -25 }]}>
          {LAYERS.map((layer, index) => (
            <Group
              key={layer.color}
              layer={
                <Paint blendMode="multiply">
                  <Blur blur={7} />
                  <ColorMatrix matrix={GOO} />
                </Paint>
              }>
              {layer.ring > 0 && <Circle cx={125} cy={125} r={68} color={layer.color} style="stroke" strokeWidth={layer.ring} />}
              <Path path={blobs[index]} color={layer.color} />
            </Group>
          ))}

          <Circle cx={125} cy={125} r={63.5} color={Colors.bg} />
          <Group clip={CLIP}>
            <Circle cx={125} cy={125} r={60} color={SKIN_BG} />
            <Group transform={[{ translateX: 45 }, { translateY: 47 }]}>
              <Part d="M72 92 L72 110 Q80 116 88 110 L88 92 Z" fill={SKIN} />
              <Part d="M26 152 C28 124 50 110 72 108 Q80 118 88 108 C110 110 132 124 134 152 Z" fill={Colors.primary} />

              <Group origin={{ x: 80, y: 104 }} transform={headTransform}>
                <Part d="M57 62 C50 60 50 74 57 72" fill={SKIN} open />
                <Part d="M103 62 C110 60 110 74 103 72" fill={SKIN} open />
                <Part d="M56 62 C56 46 66 38 80 38 C94 38 104 46 104 62 C104 80 94 92 80 92 C66 92 56 80 56 62 Z" fill={SKIN} />
                <Circle cx={65.6} cy={76.6} r={4.6} color={Colors.coral} opacity={0.75} />
                <Circle cx={97.6} cy={76.6} r={4.6} color={Colors.coral} opacity={0.75} />
                <Part d="M55 62 C50 40 62 27 82 27 C99 27 110 40 105 60 C102 52 97 47 91 47 C83 41 70 42 63 49 C59 53 57 57 55 62 Z" fill={INK} />
                <Group transform={browTransform}>
                  <Line d="M65 58 q5 -3 10 0" />
                  <Line d="M85 58 q5 -3 10 0" />
                </Group>
                <Oval rect={eyeL} color={INK} />
                <Oval rect={eyeR} color={INK} />
                <Line d="M80 66 q-2.5 6 1.5 7" width={2} />
                <Line d={mouth} />
              </Group>

              <Group opacity={armOpacity}>
                <Path path={forearm} color={INK} style="stroke" strokeWidth={15} strokeCap="round" />
                <Path path={forearm} color={SKIN} style="stroke" strokeWidth={10.5} strokeCap="round" transform={[{ translateX: 1.2 }, { translateY: 1.2 }]} />
                <Path path={sleeve} color={INK} style="stroke" strokeWidth={21} strokeCap="round" />
                <Path path={sleeve} color={Colors.primary} style="stroke" strokeWidth={16.5} strokeCap="round" transform={[{ translateX: 1.2 }, { translateY: 1.2 }]} />
                <Group transform={handTransform}>
                  <Part d="M-6 0 C-8 -7 -8 -15 -5 -20 C-3 -24 2 -24 4 -20 C7 -21 10 -17 9 -12 C10 -8 9 -3 7 0" fill={SKIN} open />
                  <Part d="M-6 -2 C-11 -4 -12 -11 -8 -12 C-6 -12 -5 -9 -5 -6" fill={SKIN} open />
                  <Line d="M-1 -21 L0 -13 M3.5 -20 L4 -13" width={1.6} />
                </Group>
              </Group>
            </Group>
          </Group>
          <Circle cx={125} cy={125} r={60} color={INK} style="stroke" strokeWidth={2.4} />
        </Group>
      </Canvas>
    </View>
  );
}

type Shared = SharedValue<number>;

function eyeRect(x: number, t: number, raise: number, think: number) {
  'worklet';
  const blinkPhase = t % 4.1;
  const openness = blinkPhase < 0.14 ? 1 - Math.sin((blinkPhase / 0.14) * Math.PI) * 0.9 : 1;
  const cx = x + raise * 1.6 - think * 1.5 + (1 - raise) * (1 - think) * Math.sin(t * 0.5) * 0.8;
  const cy = 65 - think * 2.5;
  return Skia.XYWHRect(cx - 2.3, cy - 2.8 * openness, 4.6, 5.6 * openness);
}

/** Các giọt của một lớp gộp thành một đường để vẽ một lần. */
function useLayerPath(index: number, t: Shared, phase: Shared, raise: Shared, think: Shared) {
  const layer = LAYERS[index];
  return useDerivedValue(() => {
    const path = Skia.PathBuilder.Make();
    const loud = raise.value * (0.35 + 0.65 * Math.abs(Math.sin(t.value * 7.3) * Math.sin(t.value * 3.1 + 1)));
    const gather = think.value;
    const first = index + phase.value * layer.dir;
    for (let i = 0; i < layer.count; i++) {
      const free = (i / layer.count) * 6.283 + index + phase.value * layer.dir;
      // Đang xem: các giọt dồn lại thành một chuỗi chạy vòng.
      const angle = free * (1 - gather) + (first + i * 0.42) * gather;
      const orbit = layer.orbit + Math.sin(t.value * 1.7 + i * 2.1 + index) * 4 + loud * (10 + 4 * Math.sin(i * 3));
      const calm = 1 - 0.2 * (1 - raise.value) * (1 - gather);
      const radius = (layer.blob * (0.75 + 0.25 * Math.sin(t.value * 1.3 + i + index)) + loud * 7) * calm;
      path.addCircle(125 + Math.cos(angle) * orbit, 125 + Math.sin(angle) * orbit, radius);
    }
    return path.build();
  });
}

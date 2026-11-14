import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, Text, type TextProps, View, type ViewStyle } from 'react-native';

import { Colors, Fonts, FontSize, Radius, riso, Spacing } from '@/constants/theme';

type Weight = keyof typeof Fonts;

export function Txt({
  size = FontSize.body,
  weight = 'regular',
  color = Colors.text,
  center,
  style,
  ...rest
}: TextProps & { size?: number; weight?: Weight; color?: string; center?: boolean }) {
  return (
    <Text
      // Máy người lớn tuổi hay đặt cỡ chữ hệ thống rất to; chữ trong app đã to sẵn nên chỉ cho phóng thêm chút.
      maxFontSizeMultiplier={1.15}
      style={[
        { fontFamily: Fonts[weight], fontSize: size, lineHeight: Math.round(size * 1.35), color },
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

type Tone = 'primary' | 'danger' | 'paper' | 'coral';

const TONES: Record<Tone, { bg: string; fg: string; shadow: string }> = {
  primary: { bg: Colors.primary, fg: Colors.white, shadow: Colors.coral },
  danger: { bg: Colors.danger, fg: Colors.white, shadow: Colors.text },
  paper: { bg: Colors.surface, fg: Colors.text, shadow: Colors.primary },
  coral: { bg: Colors.coral, fg: Colors.text, shadow: Colors.primary },
};

// Người run tay hay chạm hai lần liền nhau: bỏ qua lần chạm thứ hai trong khoảng này.
const DOUBLE_TAP_GUARD_MS = 700;

export function BigButton({
  label,
  sub,
  icon,
  onPress,
  tone = 'primary',
  height = 72,
  fontSize = FontSize.parentBody,
  disabled,
  vertical,
  style,
}: {
  label: string;
  /** Dòng giải thích nhỏ dưới nhãn. */
  sub?: string;
  icon?: SFSymbol;
  onPress: () => void;
  tone?: Tone;
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  /** Biểu tượng nằm trên, chữ nằm dưới (cho hàng nhiều nút hẹp). */
  vertical?: boolean;
  style?: ViewStyle;
}) {
  const t = TONES[tone];
  const lastPress = useRef(0);
  const press = () => {
    const now = Date.now();
    if (now - lastPress.current < DOUBLE_TAP_GUARD_MS) return;
    lastPress.current = now;
    // Rung nhẹ để biết máy đã nhận lần chạm.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onPress();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => [
        riso(t.shadow),
        styles.button,
        vertical && styles.vertical,
        { backgroundColor: t.bg, minHeight: height },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon && <SymbolView name={icon} size={Math.round(fontSize * 1.3)} tintColor={t.fg} />}
      <View style={styles.buttonText}>
        <Txt size={fontSize} weight="bold" color={t.fg} center={vertical || !sub} numberOfLines={vertical ? 1 : 2} adjustsFontSizeToFit={vertical}>
          {label}
        </Txt>
        {!!sub && (
          <Txt size={FontSize.sub} weight="semibold" color={t.fg} style={styles.sub}>
            {sub}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}

export function Card({
  children,
  color = Colors.surface,
  shadow = Colors.primary,
  style,
}: {
  children: ReactNode;
  color?: string;
  shadow?: string;
  style?: ViewStyle;
}) {
  return <View style={[riso(shadow), styles.card, { backgroundColor: color }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  button: {
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  vertical: { flexDirection: 'column', gap: Spacing.one, paddingHorizontal: Spacing.two },
  buttonText: { flexShrink: 1 },
  sub: { opacity: 0.92 },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOffset: { width: 0, height: 0 }, opacity: 0.85 },
  disabled: { opacity: 0.5 },
  card: { padding: Spacing.three, gap: Spacing.two },
});

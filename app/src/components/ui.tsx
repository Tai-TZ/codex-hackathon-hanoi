import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
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

export function BigButton({
  label,
  icon,
  onPress,
  tone = 'primary',
  height = 72,
  fontSize = FontSize.parentBody,
  disabled,
  style,
}: {
  label: string;
  icon?: SFSymbol;
  onPress: () => void;
  tone?: Tone;
  height?: number;
  fontSize?: number;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        riso(t.shadow),
        styles.button,
        { backgroundColor: t.bg, minHeight: height },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon && <SymbolView name={icon} size={Math.round(fontSize * 1.3)} tintColor={t.fg} />}
      <Txt size={fontSize} weight="bold" color={t.fg} center style={styles.buttonLabel}>
        {label}
      </Txt>
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
  buttonLabel: { flexShrink: 1 },
  pressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 1, height: 1 } },
  disabled: { opacity: 0.5 },
  card: { padding: Spacing.three, gap: Spacing.two },
});

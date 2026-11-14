/** Phong cách đã chốt: giấy kem, nét mực, in riso hai màu (xanh ngọc + cam san hô). */
import type { ViewStyle } from 'react-native';

import type { Risk } from '@/types/hoicon';

export const Colors = {
  bg: '#FBF6EE',
  surface: '#FFFFFF',
  text: '#1D2B3A',
  textMuted: '#5B514A',
  primary: '#0B6E69',
  primarySoft: '#DDF1EE',
  teal: '#8ED6CC',
  coral: '#FF9E80',
  coralSoft: '#FFE7DD',
  danger: '#B42318',
  dangerSoft: '#FDECEC',
  dangerText: '#9F1D1D',
  warn: '#B25E09',
  warnSoft: '#FFF1CC',
  warnText: '#6B4500',
  safe: '#0B6E69',
  safeSoft: '#E1F3EA',
  safeText: '#0B4F4B',
  white: '#FFFFFF',
  hint: '#8E8780',
  line: '#D9D3C8',
  overlay: 'rgba(29, 43, 58, 0.55)',
} as const;

export const Fonts = {
  regular: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_800ExtraBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const FontSize = {
  small: 14,
  body: 17,
  sub: 19,
  parentBody: 22,
  parentLarge: 26,
  heading: 28,
  title: 36,
} as const;

export const Radius = { card: 28, button: 999, pill: 999 } as const;

/** Khung mềm theo bản mẫu đã chốt: viền mảnh màu giấy sẫm, bo tròn, không bóng. Tham số giữ lại cho tương thích. */
export function riso(_accent: string = Colors.primary): ViewStyle {
  return {
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderRadius: Radius.card,
  };
}

export const RiskTheme: Record<Risk, { label: string; solid: string; soft: string; text: string }> = {
  red: { label: 'NGUY HIỂM', solid: Colors.danger, soft: Colors.dangerSoft, text: Colors.dangerText },
  yellow: { label: 'CẦN CHÚ Ý', solid: Colors.warn, soft: Colors.warnSoft, text: Colors.warnText },
  green: { label: 'AN TOÀN', solid: Colors.safe, soft: Colors.safeSoft, text: Colors.safeText },
};

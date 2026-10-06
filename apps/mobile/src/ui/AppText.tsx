import { Text, type TextProps } from 'react-native';

import { colors, textStyles, type TextVariant } from '../theme/tokens';

const toneColors = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.textInverse,
  inverseMuted: colors.textInverseMuted,
  brand: colors.brand,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

export type TextTone = keyof typeof toneColors;

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
};

export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[textStyles[variant], { color: toneColors[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}

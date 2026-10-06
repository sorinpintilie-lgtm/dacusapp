import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, continuous, fonts, radii, spacing } from '../theme/tokens';
import { fadeIn } from './motion';
import { Touchable } from './Touchable';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'onDark';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const palette: Record<ButtonVariant, { background: string; text: string; border?: string }> = {
  primary: { background: colors.brand, text: colors.textInverse },
  dark: { background: colors.ink, text: colors.textInverse },
  secondary: { background: colors.well, text: colors.textPrimary },
  outline: { background: colors.surface, text: colors.textPrimary, border: colors.lineStrong },
  ghost: { background: 'transparent', text: colors.textPrimary },
  /** Outline button for dark cards. */
  onDark: { background: 'transparent', text: colors.textInverse, border: 'rgba(255, 255, 255, 0.35)' },
};

const sizes: Record<ButtonSize, { height: number; fontSize: number; icon: number; paddingX: number }> = {
  sm: { height: 38, fontSize: 14, icon: 16, paddingX: spacing.sm },
  md: { height: 48, fontSize: 16, icon: 18, paddingX: spacing.md },
  lg: { height: 54, fontSize: 17, icon: 20, paddingX: spacing.lg },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const colorSet = palette[variant];
  const sizeSet = sizes[size];
  const iconNode = icon ? <Ionicons name={icon} size={sizeSet.icon} color={colorSet.text} /> : null;

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled || loading}
      haptic="light"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        {
          height: sizeSet.height,
          paddingHorizontal: variant === 'ghost' ? spacing.xs : sizeSet.paddingX,
          backgroundColor: colorSet.background,
          borderColor: colorSet.border ?? 'transparent',
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colorSet.text} />
      ) : (
        // Re-keyed on the label so a change (e.g. "Adaugă" -> "Adăugat") cross-fades instead of jumping.
        <Animated.View key={`${title}-${icon ?? ''}`} entering={fadeIn} style={styles.content}>
          {iconPosition === 'left' ? iconNode : null}
          <Text numberOfLines={1} style={[styles.label, { color: colorSet.text, fontSize: sizeSet.fontSize }]}>
            {title}
          </Text>
          {iconPosition === 'right' ? iconNode : null}
        </Animated.View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    ...continuous,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontFamily: fonts.semibold, letterSpacing: 0.1 },
});

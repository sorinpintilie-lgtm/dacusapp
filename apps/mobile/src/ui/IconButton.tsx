import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, hitSlop, radii, shadows } from '../theme/tokens';
import { Touchable } from './Touchable';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  /**
   * plain: icon only · soft: grey disc · floating: white disc with shadow (over photos)
   * brand: red disc · dark: ink disc
   */
  variant?: 'plain' | 'soft' | 'floating' | 'brand' | 'dark';
  size?: number;
  color?: string;
  badge?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const backgrounds = {
  plain: 'transparent',
  soft: colors.well,
  floating: colors.surface,
  brand: colors.brand,
  dark: colors.ink,
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  size = 40,
  color,
  badge,
  disabled,
  style,
}: IconButtonProps) {
  const iconColor = color ?? (variant === 'brand' || variant === 'dark' ? colors.textInverse : colors.textPrimary);

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      hitSlop={hitSlop}
      pressedScale={0.88}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: size, height: size, backgroundColor: backgrounds[variant] },
        variant === 'floating' && shadows.float,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={iconColor} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.textInverse, fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
});

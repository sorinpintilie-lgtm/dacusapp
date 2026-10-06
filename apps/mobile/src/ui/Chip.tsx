import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '../theme/tokens';
import { Touchable } from './Touchable';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Shows a chevron, for chips that open a picker. */
  dropdown?: boolean;
  /** Small counter after the label (e.g. active filters). */
  count?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
};

export function Chip({ label, selected = false, onPress, icon, dropdown = false, count, disabled, size = 'md' }: ChipProps) {
  const foreground = selected ? colors.textInverse : colors.textPrimary;

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      pressedScale={0.94}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={count ? `${label}, ${count} active` : label}
      style={[styles.chip, size === 'sm' && styles.chipSmall, selected ? styles.selected : styles.idle]}
    >
      {icon ? <Ionicons name={icon} size={16} color={foreground} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: foreground }]}>
        {label}
      </Text>
      {count ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
      {dropdown ? <Ionicons name="chevron-down" size={14} color={foreground} /> : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSmall: { height: 32, paddingHorizontal: spacing.sm },
  idle: { backgroundColor: colors.well },
  selected: { backgroundColor: colors.ink },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, maxWidth: 240 },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 13, color: colors.textInverse },
});

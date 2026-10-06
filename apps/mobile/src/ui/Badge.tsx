import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radii } from '../theme/tokens';
import { getStockBadgeTone } from '../utils/catalogFilters';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type BadgeTone = 'neutral' | 'brand' | 'brandSoft' | 'dark' | 'success' | 'warning';

const tones: Record<BadgeTone, { background: string; text: string }> = {
  neutral: { background: colors.well, text: colors.textSecondary },
  brand: { background: colors.brand, text: colors.textInverse },
  brandSoft: { background: colors.brandTint, text: colors.brand },
  dark: { background: colors.ink, text: colors.textInverse },
  success: { background: colors.successTint, text: colors.success },
  warning: { background: colors.warningTint, text: colors.warning },
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'neutral', icon, style }: BadgeProps) {
  const colorSet = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colorSet.background }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={colorSet.text} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color: colorSet.text }]}>
        {label}
      </Text>
    </View>
  );
}

/** Stock state as a quiet line: icon + text, coloured only when it matters. */
export function StockLine({ label, inStock }: { label: string; inStock: boolean }) {
  const tone = inStock ? getStockBadgeTone(label) : 'outOfStock';
  const color = tone === 'outOfStock' ? colors.brand : tone === 'limited' ? colors.warning : colors.success;
  const icon: IconName = tone === 'outOfStock' ? 'close-circle' : tone === 'limited' ? 'time' : 'checkmark-circle';
  const text = tone === 'outOfStock' ? 'Stoc epuizat' : tone === 'limited' ? label : 'În stoc';
  return (
    <View style={styles.stock}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.stockText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
  },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, letterSpacing: 0.2 },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stockText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
});

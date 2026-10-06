import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, priceStyles } from '../theme/tokens';
import { formatPrice } from '../utils/catalogFilters';

type PriceTagProps = {
  price: number;
  oldPrice?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Light text, for dark backgrounds. */
  inverse?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const discountPercent = (price: number, oldPrice?: number) =>
  typeof oldPrice === 'number' && oldPrice > price ? Math.max(1, Math.round(((oldPrice - price) / oldPrice) * 100)) : 0;

const oldPriceSizes = { sm: 12, md: 14, lg: 16 };

export function PriceTag({ price, oldPrice, size = 'md', inverse = false, style }: PriceTagProps) {
  const hasDiscount = discountPercent(price, oldPrice) > 0;
  const color = hasDiscount ? colors.brand : inverse ? colors.textInverse : colors.textPrimary;

  return (
    <View style={[styles.row, style]}>
      <Text style={[priceStyles[size], { color }]} numberOfLines={1}>
        {formatPrice(price)}
      </Text>
      {hasDiscount ? (
        <Text style={[styles.oldPrice, { fontSize: oldPriceSizes[size] }]} numberOfLines={1}>
          {formatPrice(oldPrice)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
  oldPrice: {
    fontFamily: fonts.medium,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
});

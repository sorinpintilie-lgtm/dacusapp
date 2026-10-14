import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CatalogProduct } from '../data/catalog';
import { colors, continuous, fonts, radii, spacing } from '../theme/tokens';
import { sizedImageUrl } from './images';
import { PriceTag } from './PriceTag';
import { hasImageUrl } from './ProductCard';
import { ProductImage } from './ProductImage';
import { Touchable } from './Touchable';

type ProductRowProps = {
  product: CatalogProduct;
  onPress?: (productId: string) => void;
  /** Extra line under the name (variant, quantity…). */
  meta?: string;
  /** Price shown instead of the catalog price (e.g. the unit price in the cart). */
  price?: number;
  /** Hides the price (e.g. when the caller shows a line total instead). */
  hidePrice?: boolean;
  thumbSize?: number;
  /** Controls on the right (e.g. remove); kept outside the pressable area. */
  right?: ReactNode;
  /** Controls under the details (e.g. a quantity stepper); kept outside the pressable area. */
  children?: ReactNode;
  /** Highlights the part of the name that matched a search. */
  highlight?: (name: string) => ReactNode;
};

function ProductRowComponent({
  product,
  onPress,
  meta,
  price,
  hidePrice = false,
  thumbSize = 68,
  right,
  children,
  highlight,
}: ProductRowProps) {
  const imageUrl = product.thumbnailUrl ?? product.imageUrl;

  const details = (
    <>
      <View style={[styles.thumb, { width: thumbSize, height: thumbSize }]}>
        <View style={styles.blend}>
          <ProductImage uri={hasImageUrl(imageUrl) ? sizedImageUrl(imageUrl, thumbSize) : undefined} iconSize={22} />
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {highlight ? highlight(product.name) : product.name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {hidePrice ? null : (
          <PriceTag price={price ?? product.priceRon} oldPrice={price === undefined ? product.oldPriceRon : undefined} size="sm" />
        )}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {onPress ? (
          <Touchable
            onPress={() => onPress(product.id)}
            pressedScale={0.98}
            style={styles.main}
            accessibilityLabel={product.name}
          >
            {details}
          </Touchable>
        ) : (
          <View style={styles.main}>{details}</View>
        )}
        {right}
      </View>
      {children ? <View style={[styles.children, { marginLeft: thumbSize + spacing.sm }]}>{children}</View> : null}
    </View>
  );
}

export const ProductRow = memo(ProductRowComponent);

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: {
    borderRadius: radii.sm,
    ...continuous,
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    isolation: 'isolate',
  },
  blend: { width: '100%', height: '100%', padding: 6, mixBlendMode: 'multiply' },
  info: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 19, color: colors.textPrimary },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.textSecondary },
  children: {},
});

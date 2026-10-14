import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CatalogProduct } from '../data/catalog';
import { colors, continuous, fonts, hitSlop, radii, spacing } from '../theme/tokens';
import { isProductInStock } from '../utils/catalogFilters';
import { Badge } from './Badge';
import { sizedImageUrl } from './images';
import { discountPercent, PriceTag } from './PriceTag';
import { AddToCartButton, HeartButton } from './ProductActions';
import { ProductImage } from './ProductImage';
import { Touchable } from './Touchable';

export const hasImageUrl = (value: string | undefined): value is string => !!value && /^https?:\/\//.test(value);

/** The house brand is on most products; only other brands are worth a line. */
export const displayBrand = (brand: string | undefined) =>
  brand && brand.trim().toLowerCase() !== 'dacus' ? brand.trim() : undefined;

type ProductCardProps = {
  product: CatalogProduct;
  width: number;
  onPress: (productId: string) => void;
  onAddToCart: (productId: string) => void;
  wishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  /** Compare mode: the card shows a select toggle instead of the heart. */
  compareMode?: boolean;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (productId: string) => void;
};

const ADD_SIZE = 36;
const CORNER_INSET = 8;

function ProductCardComponent({
  product,
  width,
  onPress,
  onAddToCart,
  wishlisted = false,
  onToggleWishlist,
  compareMode = false,
  compareSelected = false,
  compareDisabled = false,
  onToggleCompare,
}: ProductCardProps) {
  const imageUrl = product.thumbnailUrl ?? product.imageUrl;
  const discount = discountPercent(product.priceRon, product.oldPriceRon);
  const inStock = isProductInStock(product);
  const brand = displayBrand(product.brand);

  // The heart, compare and add buttons are siblings of the card's pressable (not inside it),
  // so a tap on them never also opens the product.
  return (
    <View style={{ width }}>
      <Touchable
        onPress={() => onPress(product.id)}
        pressedScale={0.97}
        accessibilityLabel={[product.name, brand, inStock ? null : 'stoc epuizat'].filter(Boolean).join(', ')}
        style={styles.pressable}
      >
        <View style={[styles.well, { height: width }]}>
          <View style={[styles.blend, !inStock && styles.muted]}>
            <ProductImage uri={hasImageUrl(imageUrl) ? sizedImageUrl(imageUrl, width) : undefined} iconSize={30} />
          </View>
          {discount > 0 ? <Badge label={`-${discount}%`} tone="brand" style={styles.discount} /> : null}
          {!inStock ? <Badge label="Stoc epuizat" tone="neutral" style={styles.soldOut} /> : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <PriceTag price={product.priceRon} oldPrice={product.oldPriceRon} size="sm" />
        </View>
      </Touchable>

      {compareMode ? (
        <Touchable
          onPress={() => onToggleCompare?.(product.id)}
          disabled={compareDisabled && !compareSelected}
          hitSlop={hitSlop}
          pressedScale={0.85}
          haptic="selection"
          accessibilityLabel={compareSelected ? 'Scoate din comparație' : 'Adaugă la comparație'}
          accessibilityState={{ selected: compareSelected }}
          style={[styles.compare, compareSelected && styles.compareSelected]}
        >
          <Ionicons
            name={compareSelected ? 'checkmark' : 'add'}
            size={18}
            color={compareSelected ? colors.textInverse : colors.textPrimary}
          />
        </Touchable>
      ) : onToggleWishlist ? (
        <HeartButton
          active={wishlisted}
          onPress={() => onToggleWishlist(product.id)}
          style={styles.heart}
        />
      ) : null}

      {inStock && !compareMode ? (
        <AddToCartButton
          onPress={() => onAddToCart(product.id)}
          accessibilityLabel={`Adaugă în coș: ${product.name}`}
          size={ADD_SIZE}
          style={[styles.add, { top: width - ADD_SIZE - CORNER_INSET }]}
        />
      ) : null}
    </View>
  );
}

export const ProductCard = memo(ProductCardComponent);

const styles = StyleSheet.create({
  pressable: { gap: spacing.xs },
  well: {
    backgroundColor: colors.well,
    borderRadius: radii.md,
    ...continuous,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    isolation: 'isolate',
  },
  // Product shots are mostly on white; multiplying them onto the grey well removes the white box.
  blend: { width: '100%', height: '100%', padding: spacing.sm, mixBlendMode: 'multiply' },
  muted: { opacity: 0.45 },
  discount: { position: 'absolute', top: CORNER_INSET, left: CORNER_INSET },
  soldOut: { position: 'absolute', bottom: CORNER_INSET, left: CORNER_INSET },
  body: { gap: 3, paddingHorizontal: 2 },
  name: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.textPrimary, minHeight: 36 },
  heart: { position: 'absolute', top: 4, right: 4 },
  compare: {
    position: 'absolute',
    top: CORNER_INSET,
    right: CORNER_INSET,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  add: { position: 'absolute', right: CORNER_INSET },
});

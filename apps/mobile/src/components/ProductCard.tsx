import { memo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { CatalogProduct } from '../data/catalog';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { formatPrice } from '../utils/catalogFilters';

const hasImageUrl = (value: string | undefined): value is string => !!value && /^https?:\/\//.test(value);

type ProductCardProps = {
  product: CatalogProduct;
  compact?: boolean;
  onOpen: (productId: string) => void;
  onOpenImage: (url: string | undefined) => void;
  onAdd: (productId: string) => void;
};

export const ProductCard = memo(({ product, compact = false, onOpen, onOpenImage, onAdd }: ProductCardProps) => {
  const hasDiscount = typeof product.oldPriceRon === 'number' && product.oldPriceRon > product.priceRon;
  const discountPercent = hasDiscount
    ? Math.max(1, Math.round(((product.oldPriceRon! - product.priceRon) / product.oldPriceRon!) * 100))
    : 0;

  return (
    <View style={[styles.productCard, compact && styles.productCardCompact]}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => onOpenImage(product.imageUrl)} style={styles.productMediaWrap}>
        {hasImageUrl(product.thumbnailUrl) || hasImageUrl(product.imageUrl) ? (
          <Image
            source={{ uri: product.thumbnailUrl ?? product.imageUrl }}
            style={[styles.productMedia, compact && styles.productMediaCompact]}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.productMedia, compact && styles.productMediaCompact]} />
        )}
      </TouchableOpacity>

      {hasDiscount ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
        </View>
      ) : null}

      <TouchableOpacity activeOpacity={0.86} onPress={() => onOpen(product.id)} style={styles.productCardTapArea}>
        <View style={styles.productCardBody}>
          <Text style={styles.productBrand}>{product.brand}</Text>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          {product.sku ? <Text style={styles.productSku}>SKU: {product.sku}</Text> : null}

          <View style={styles.priceBlock}>
            <Text style={styles.productPrice}>{formatPrice(product.priceRon)}</Text>
            {hasDiscount ? <Text style={styles.productOldPrice}>{formatPrice(product.oldPriceRon)}</Text> : null}
          </View>

          <View style={styles.stockPill}>
            <Text style={styles.stockPillText}>{product.stockLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.9} style={styles.addButton} onPress={() => onAdd(product.id)}>
        <Text style={styles.addButtonText}>Adaugă rapid</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productCardCompact: {
    minHeight: 258,
  },
  productCardTapArea: { flex: 1 },
  productMediaWrap: { width: '100%', backgroundColor: '#FAFBFC' },
  productMedia: {
    width: '100%',
    height: 124,
    backgroundColor: colors.surfaceSoft,
  },
  productMediaCompact: {
    height: 118,
  },
  productCardBody: {
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.brandRed,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  discountBadgeText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900' },
  priceBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  addButton: {
    backgroundColor: colors.brandRed,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xxs,
    borderRadius: radii.md,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.caption },
  productName: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700', lineHeight: 17 },
  productBrand: { fontSize: typography.micro, color: colors.textSecondary, fontWeight: '700' },
  productSku: { fontSize: typography.micro, color: colors.textSecondary },
  productPrice: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '900' },
  productOldPrice: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stockPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    backgroundColor: '#E8F5EE',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  stockPillText: { color: colors.success, fontSize: typography.micro, fontWeight: '800' },
});

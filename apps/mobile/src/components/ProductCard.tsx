import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';

import type { CatalogProduct } from '../data/catalog';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { formatPrice, getStockBadgeTone } from '../utils/catalogFilters';

const hasImageUrl = (value: string | undefined): value is string =>
  !!value && /^https?:\/\//.test(value);

type ProductCardProps = {
  product: CatalogProduct;
  compact?: boolean;
  onOpen: (productId: string) => void;
  onAdd: (productId: string) => void;
  compareMode?: boolean;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (productId: string) => void;
};

export const ProductCard = memo(
  ({
    product,
    compact = false,
    onOpen,
    onAdd,
    compareMode = false,
    compareSelected = false,
    compareDisabled = false,
    onToggleCompare,
  }: ProductCardProps) => {
    const hasDiscount =
      typeof product.oldPriceRon === 'number' && product.oldPriceRon > product.priceRon;
    const discountPercent = hasDiscount
      ? Math.max(
          1,
          Math.round(((product.oldPriceRon! - product.priceRon) / product.oldPriceRon!) * 100),
        )
      : 0;
    const stockTone = getStockBadgeTone(product.stockLabel);

    return (
      <View style={[styles.productCard, compact && styles.productCardCompact]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOpen(product.id)}
          style={styles.productTapArea}
        >
          <View style={styles.productMediaWrap}>
            {hasImageUrl(product.thumbnailUrl ?? product.imageUrl) ? (
              <Image
                source={{ uri: product.thumbnailUrl ?? product.imageUrl }}
                style={[styles.productMedia, compact && styles.productMediaCompact]}
                resizeMode="contain"
                contentFit="contain"
                transition={200}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            ) : (
              <View
                style={[
                  styles.productMedia,
                  compact && styles.productMediaCompact,
                  styles.productMediaFallback,
                ]}
              >
                <Text style={styles.productMediaFallbackText}>Fără imagine</Text>
              </View>
            )}
          </View>

          {hasDiscount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
            </View>
          ) : null}

          {compareMode ? (
            <TouchableOpacity
              activeOpacity={0.88}
              style={[
                styles.compareBadge,
                compareSelected && styles.compareBadgeSelected,
                compareDisabled && !compareSelected && styles.compareBadgeDisabled,
              ]}
              onPress={() => onToggleCompare?.(product.id)}
              disabled={compareDisabled && !compareSelected}
            >
              <Text
                style={[
                  styles.compareBadgeText,
                  compareSelected && styles.compareBadgeTextSelected,
                  compareDisabled && !compareSelected && styles.compareBadgeTextDisabled,
                ]}
              >
                {compareSelected ? '✓ Comparat' : 'Compară'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.productCardBody}>
            <Text style={styles.productBrand}>{product.brand}</Text>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            {product.sku ? <Text style={styles.productSku}>SKU: {product.sku}</Text> : null}

            <View style={styles.priceBlock}>
              <Text style={styles.productPrice}>{formatPrice(product.priceRon)}</Text>
              {hasDiscount ? (
                <Text style={styles.productOldPrice}>{formatPrice(product.oldPriceRon)}</Text>
              ) : null}
            </View>

            <View
              style={[
                styles.stockPill,
                stockTone === 'inStock' && styles.stockPillInStock,
                stockTone === 'limited' && styles.stockPillLimited,
                stockTone === 'outOfStock' && styles.stockPillOutOfStock,
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  stockTone === 'inStock' && styles.stockPillTextInStock,
                  stockTone === 'limited' && styles.stockPillTextLimited,
                  stockTone === 'outOfStock' && styles.stockPillTextOutOfStock,
                ]}
              >
                {product.stockLabel}
              </Text>
            </View>

            <View style={styles.productCardFooter}>
              <Text style={styles.productViewDetailsText}>Vezi detalii</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.productActionsRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.addButton}
            onPress={() => onAdd(product.id)}
          >
            <Text style={styles.addButtonText}>Adaugă în coș</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productCardCompact: {
    minHeight: 284,
  },
  productTapArea: { flex: 1 },
  productMediaWrap: { width: '100%', backgroundColor: colors.surfaceAlt },
  productMedia: {
    width: '100%',
    height: 128,
    backgroundColor: colors.surfaceSoft,
  },
  productMediaCompact: {
    height: 122,
  },
  productMediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMediaFallbackText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  productCardBody: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
  discountBadgeText: { color: colors.textInverted, fontSize: typography.micro, fontWeight: '900' },
  compareBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minHeight: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandRed,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareBadgeSelected: {
    backgroundColor: colors.brandRed,
    borderColor: colors.brandRed,
  },
  compareBadgeDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  compareBadgeText: {
    color: colors.brandRed,
    fontSize: typography.micro,
    fontWeight: '800',
  },
  compareBadgeTextSelected: {
    color: colors.textInverted,
  },
  compareBadgeTextDisabled: {
    color: colors.textSecondary,
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  productCardFooter: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  productViewDetailsText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  productActionsRow: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  addButton: {
    backgroundColor: colors.brandRed,
    borderRadius: radii.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.textInverted, fontWeight: '800', fontSize: typography.caption },
  productName: {
    fontSize: typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 17,
  },
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
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  stockPillInStock: { backgroundColor: colors.semanticSuccessBg },
  stockPillLimited: { backgroundColor: colors.semanticWarningBg },
  stockPillOutOfStock: { backgroundColor: colors.semanticDangerBg },
  stockPillText: { fontSize: typography.micro, fontWeight: '800' },
  stockPillTextInStock: { color: colors.success },
  stockPillTextLimited: { color: colors.warning },
  stockPillTextOutOfStock: { color: colors.brandRed },
});

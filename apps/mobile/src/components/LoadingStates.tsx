import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

// Blurhash-like shimmer effect using Animated values
export function SkeletonShimmer({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

/**
 * Product card skeleton with realistic layout
 */
export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.productCard, compact && styles.productCardCompact]}>
      <SkeletonShimmer>
        <View style={[styles.productMedia, compact && styles.productMediaCompact]} />
      </SkeletonShimmer>
      <View style={styles.productCardBody}>
        <SkeletonShimmer>
          <View style={styles.skeletonTitle} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.skeletonSubtitle} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.skeletonPrice} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.skeletonButton} />
        </SkeletonShimmer>
      </View>
    </View>
  );
}

/**
 * Grid of product card skeletons
 * columns reserved for future use (multi-column support)
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={[styles.gridWrap, { flexDirection: 'row', flexWrap: 'wrap' }]}>
      {items.map((i) => (
        <View key={i} style={styles.gridCell}>
          <ProductCardSkeleton compact />
        </View>
      ))}
    </View>
  );
}

/**
 * Product details skeleton
 */
export function ProductDetailsSkeleton() {
  return (
    <View style={styles.detailsContainer}>
      {/* Back button */}
      <View style={styles.skeletonBackButton} />

      {/* Image */}
      <SkeletonShimmer>
        <View style={styles.detailsImage} />
      </SkeletonShimmer>

      {/* Title */}
      <SkeletonShimmer>
        <View style={styles.detailsTitle} />
      </SkeletonShimmer>

      {/* Brand */}
      <SkeletonShimmer>
        <View style={styles.detailsBrand} />
      </SkeletonShimmer>

      {/* Price */}
      <SkeletonShimmer>
        <View style={styles.detailsPrice} />
      </SkeletonShimmer>

      {/* Description lines */}
      <SkeletonShimmer>
        <View style={styles.detailsDesc1} />
      </SkeletonShimmer>
      <SkeletonShimmer>
        <View style={styles.detailsDesc2} />
      </SkeletonShimmer>
      <SkeletonShimmer>
        <View style={styles.detailsDesc3} />
      </SkeletonShimmer>
      <SkeletonShimmer>
        <View style={styles.detailsDesc4} />
      </SkeletonShimmer>

      {/* Action buttons */}
      <View style={styles.detailsActions}>
        <SkeletonShimmer>
          <View style={styles.detailsPrimaryButton} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.detailsSecondaryButton} />
        </SkeletonShimmer>
      </View>
    </View>
  );
}

/**
 * Horizontal product rail skeleton
 */
export function ProductRailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.railContainer}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.railCard}>
          <ProductCardSkeleton compact />
        </View>
      ))}
    </View>
  );
}

/**
 * Category card skeleton
 */
export function CategoryCardSkeleton() {
  return (
    <View style={styles.categoryCard}>
      <SkeletonShimmer>
        <View style={styles.categoryIcon} />
      </SkeletonShimmer>
      <View style={styles.categoryContent}>
        <SkeletonShimmer>
          <View style={styles.categoryTitle} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.categorySubtitle} />
        </SkeletonShimmer>
      </View>
    </View>
  );
}

/**
 * Cart item skeleton
 */
export function CartItemSkeleton() {
  return (
    <View style={styles.cartItem}>
      <SkeletonShimmer>
        <View style={styles.cartItemImage} />
      </SkeletonShimmer>
      <View style={styles.cartItemContent}>
        <SkeletonShimmer>
          <View style={styles.cartItemTitle} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.cartItemPrice} />
        </SkeletonShimmer>
        <SkeletonShimmer>
          <View style={styles.cartItemQuantity} />
        </SkeletonShimmer>
      </View>
    </View>
  );
}

/**
 * Full screen loading overlay
 */
export function LoadingOverlay({ message = 'Se încarcă...' }: { message?: string }) {
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <View style={styles.loadingSpinner} />
        <Animated.Text style={styles.loadingText}>{message}</Animated.Text>
      </View>
    </View>
  );
}

/**
 * Inline loading indicator
 */
export function LoadingDots({ color = colors.brandRed }: { color?: string }) {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const a1 = animateDot(anim1, 0);
    const a2 = animateDot(anim2, 150);
    const a3 = animateDot(anim3, 300);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [anim1, anim2, anim3]);

  const getOpacity = (anim: Animated.Value) =>
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    });

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: getOpacity(anim1) }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: getOpacity(anim2) }]} />
      <Animated.View style={[styles.dot, { backgroundColor: color, opacity: getOpacity(anim3) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Product card
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
  productMedia: {
    width: '100%',
    height: 124,
    backgroundColor: colors.skeletonBase,
  },
  productMediaCompact: {
    height: 118,
  },
  productCardBody: {
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  skeletonTitle: {
    height: 16,
    width: '80%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  skeletonSubtitle: {
    height: 12,
    width: '50%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  skeletonPrice: {
    height: 20,
    width: '40%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  skeletonButton: {
    height: 36,
    width: '100%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },

  // Grid
  gridWrap: {
    gap: spacing.sm,
  },
  gridCell: {
    width: '48%',
  },

  // Details
  detailsContainer: {
    gap: spacing.md,
  },
  detailsImage: {
    height: 286,
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.lg,
  },
  detailsTitle: {
    height: 24,
    width: '90%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsBrand: {
    height: 16,
    width: '40%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsPrice: {
    height: 32,
    width: '30%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsDesc1: {
    height: 14,
    width: '100%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsDesc2: {
    height: 14,
    width: '95%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsDesc3: {
    height: 14,
    width: '85%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsDesc4: {
    height: 14,
    width: '60%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  detailsActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detailsPrimaryButton: {
    height: 48,
    width: '100%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
  },
  detailsSecondaryButton: {
    height: 48,
    width: '100%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
  },
  skeletonBackButton: {
    height: 40,
    width: 120,
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
  },

  // Rail
  railContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  railCard: {
    width: 196,
  },

  // Category
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.skeletonBase,
  },
  categoryContent: {
    flex: 1,
    gap: spacing.xs,
  },
  categoryTitle: {
    height: 18,
    width: '70%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  categorySubtitle: {
    height: 14,
    width: '40%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },

  // Cart
  cartItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  cartItemImage: {
    width: 80,
    height: 80,
    borderRadius: radii.md,
    backgroundColor: colors.skeletonBase,
  },
  cartItemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  cartItemTitle: {
    height: 16,
    width: '80%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  cartItemPrice: {
    height: 18,
    width: '30%',
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },
  cartItemQuantity: {
    height: 32,
    width: 100,
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingSpinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.skeletonBase,
    borderTopColor: colors.brandRed,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Loading dots
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

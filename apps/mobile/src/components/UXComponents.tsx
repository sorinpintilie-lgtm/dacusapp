import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, motion, radii, spacing } from '../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Sticky bottom action bar for product pages
 * Keeps add to cart always visible while scrolling
 */
export function StickyBottomBar({
  visible = true,
  price,
  priceLabel = 'Preț:',
  buttonLabel = 'Adaugă în coș',
  buttonIcon = 'cart',
  onButtonPress,
  secondaryButtonLabel,
  onSecondaryPress,
  loading = false,
}: {
  visible?: boolean;
  price?: string;
  priceLabel?: string;
  buttonLabel?: string;
  buttonIcon?: IconName;
  onButtonPress: () => void;
  secondaryButtonLabel?: string;
  onSecondaryPress?: () => void;
  loading?: boolean;
}) {
  const translateY = useRef(new Animated.Value(100)).current;

  React.useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [visible, translateY]);

  return (
    <Animated.View style={[styles.stickyBottomBar, { transform: [{ translateY }] }]}>
      {price && (
        <View style={styles.stickyPriceContainer}>
          <Text style={styles.stickyPriceLabel}>{priceLabel}</Text>
          <Text style={styles.stickyPriceValue}>{price}</Text>
        </View>
      )}
      <View style={styles.stickyButtons}>
        {secondaryButtonLabel && onSecondaryPress && (
          <TouchableOpacity style={styles.stickySecondaryButton} onPress={onSecondaryPress}>
            <Ionicons name="heart-outline" size={20} color={colors.brandRed} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.stickyPrimaryButton, loading && styles.stickyPrimaryButtonLoading]}
          onPress={onButtonPress}
          disabled={loading}
        >
          <Ionicons name={buttonIcon as IconName} size={20} color={colors.surface} />
          <Text style={styles.stickyPrimaryButtonText}>
            {loading ? 'Se adaugă...' : buttonLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/**
 * Collapsible filter panel for products screen
 */
export function CollapsibleFilterPanel({
  children,
  filterCount = 0,
  title = 'Filtre',
}: {
  children: React.ReactNode;
  filterCount?: number;
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = () => {
    if (expanded) {
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: motion.normal,
        useNativeDriver: true,
      }).start(() => setExpanded(false));
    } else {
      setExpanded(true);
      Animated.spring(heightAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  };

  return (
    <View style={styles.collapsibleFilter}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.collapsibleHeaderLeft}>
          <Ionicons
            name="options-outline"
            size={18}
            color={filterCount > 0 ? colors.brandRed : colors.textSecondary}
          />
          <Text style={[styles.collapsibleTitle, filterCount > 0 && styles.collapsibleTitleActive]}>
            {title}
          </Text>
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && <Animated.View style={styles.collapsibleContent}>{children}</Animated.View>}
    </View>
  );
}

/**
 * Search header bar - can be used on any screen
 */
export function SearchHeader({
  value,
  onChangeText,
  placeholder = 'Caută produse...',
  onFocus,
  onBlur,
  onSubmit,
  showClearButton = true,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  showClearButton?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.searchHeader}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoFocus={autoFocus}
        />
        {showClearButton && value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Floating cart button with badge counter
 */
export function FloatingCartButton({
  itemCount = 0,
  onPress,
}: {
  itemCount?: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();
    onPress();
  };

  if (itemCount === 0) return null;

  return (
    <Animated.View style={[styles.floatingCart, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity style={styles.floatingCartButton} onPress={handlePress} activeOpacity={0.9}>
        <Ionicons name="cart" size={24} color={colors.surface} />
        {itemCount > 0 && (
          <View style={styles.floatingCartBadge}>
            <Text style={styles.floatingCartBadgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Section header with "See all" action
 */
export function SectionHeader({
  title,
  subtitle,
  actionLabel = 'Vezi toate',
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>}
      </View>
      {onAction && (
        <TouchableOpacity
          style={styles.sectionHeaderAction}
          onPress={onAction}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.sectionHeaderActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.brandRed} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Quick action grid item
 */
export function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
  variant = 'default',
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  variant?: 'default' | 'accent';
}) {
  return (
    <TouchableOpacity
      style={[styles.quickActionCard, variant === 'accent' && styles.quickActionCardAccent]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, variant === 'accent' && styles.quickActionIconAccent]}>
        <Ionicons
          name={icon}
          size={24}
          color={variant === 'accent' ? colors.surface : colors.brandRed}
        />
      </View>
      <Text
        style={[styles.quickActionTitle, variant === 'accent' && styles.quickActionTitleAccent]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.quickActionSubtitle,
          variant === 'accent' && styles.quickActionSubtitleAccent,
        ]}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Product count badge
 */
export function ProductCountBadge({
  count,
  total,
  loading = false,
}: {
  count: number;
  total?: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <View style={styles.countBadgeLoading}>
        <View style={styles.countBadgeSkeleton} />
      </View>
    );
  }

  return (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>
        {total ? `${count} din ${total}` : `${count} produse`}
      </Text>
    </View>
  );
}

/**
 * Scroll to top button
 */
export function ScrollToTopButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: motion.normal,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.scrollToTop, { opacity: fadeAnim }]}>
      <TouchableOpacity style={styles.scrollToTopButton} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name="chevron-up" size={24} color={colors.surface} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Reusable entrance animation for screen sections
 */
export function AnimatedEntrance({
  children,
  delay = 0,
  distance = 12,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.normal,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.normal,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/**
 * Reusable surface card with semantic elevation variants
 */
export function SurfaceCard({
  children,
  tone = 'default',
  padding = 'md',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'soft' | 'info';
  padding?: 'sm' | 'md' | 'lg';
}) {
  return (
    <View
      style={[
        styles.surfaceCard,
        tone === 'soft' && styles.surfaceCardSoft,
        tone === 'info' && styles.surfaceCardInfo,
        padding === 'sm' && styles.surfaceCardPaddingSm,
        padding === 'lg' && styles.surfaceCardPaddingLg,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Reusable semantic pill for confidence/health states
 */
export function SemanticPill({
  label,
  tone = 'info',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'info' | 'danger';
}) {
  return (
    <View
      style={[
        styles.semanticPill,
        tone === 'success' && styles.semanticPillSuccess,
        tone === 'warning' && styles.semanticPillWarning,
        tone === 'danger' && styles.semanticPillDanger,
      ]}
    >
      <Text style={styles.semanticPillText}>{label}</Text>
    </View>
  );
}

/**
 * Rich empty state block with icon and optional action
 */
export function RichEmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.richEmptyState}>
      <View style={styles.richEmptyIconWrap}>
        <Ionicons name={icon as IconName} size={26} color={colors.brandRed} />
      </View>
      <Text style={styles.richEmptyTitle}>{title}</Text>
      <Text style={styles.richEmptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.richEmptyAction} onPress={onAction}>
          <Text style={styles.richEmptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Swipeable cart item actions
 */
export function SwipeableCartItem({
  children,
  onDelete,
  onFavorite,
}: {
  children: React.ReactNode;
  onDelete?: () => void;
  onFavorite?: () => void;
}) {
  // Simplified version - in production you'd use react-native-gesture-handler
  return (
    <View style={styles.swipeableContainer}>
      <View style={styles.swipeableActions}>
        {onFavorite && (
          <TouchableOpacity style={styles.swipeableAction} onPress={onFavorite}>
            <Ionicons name="heart" size={20} color={colors.surface} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={[styles.swipeableAction, styles.swipeableActionDelete]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={20} color={colors.surface} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.swipeableContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sticky bottom bar
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: 34, // Safe area
  },
  stickyPriceContainer: {
    flex: 1,
  },
  stickyPriceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  stickyPriceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.brandRed,
  },
  stickyButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stickySecondaryButton: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brandRed,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 160,
    justifyContent: 'center',
  },
  stickyPrimaryButtonLoading: {
    opacity: 0.7,
  },
  stickyPrimaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },

  // Collapsible filter
  collapsibleFilter: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...elevation.soft,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collapsibleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  collapsibleTitleActive: {
    color: colors.brandRed,
  },
  filterBadge: {
    backgroundColor: colors.brandRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  collapsibleContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  // Search header
  searchHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Floating cart
  floatingCart: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
    zIndex: 100,
  },
  floatingCartButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.medium,
  },
  floatingCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.brandBlack,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  floatingCartBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brandRed,
  },

  // Quick action card
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  quickActionCardAccent: {
    backgroundColor: colors.brandRed,
    borderColor: colors.brandRed,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconAccent: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quickActionTitleAccent: {
    color: colors.surface,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  quickActionSubtitleAccent: {
    color: 'rgba(255,255,255,0.8)',
  },

  // Count badge
  countBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
  },
  countBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  countBadgeLoading: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  countBadgeSkeleton: {
    height: 20,
    width: 80,
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.sm,
  },

  // Scroll to top
  scrollToTop: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
  },
  scrollToTopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.soft,
  },

  // Surface card variants
  surfaceCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    ...elevation.soft,
  },
  surfaceCardSoft: {
    backgroundColor: colors.surfaceSoft,
  },
  surfaceCardInfo: {
    backgroundColor: colors.semanticInfoBg,
  },
  surfaceCardPaddingSm: {
    padding: spacing.sm,
  },
  surfaceCardPaddingLg: {
    padding: spacing.lg,
  },

  // Semantic pill
  semanticPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.semanticInfoBg,
    alignSelf: 'flex-start',
  },
  semanticPillSuccess: {
    backgroundColor: colors.semanticSuccessBg,
  },
  semanticPillWarning: {
    backgroundColor: colors.semanticWarningBg,
  },
  semanticPillDanger: {
    backgroundColor: colors.semanticDangerBg,
  },
  semanticPillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Rich empty state
  richEmptyState: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...elevation.soft,
  },
  richEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.semanticDangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  richEmptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  richEmptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  richEmptyAction: {
    backgroundColor: colors.brandRed,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  richEmptyActionText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },

  // Swipeable cart item
  swipeableContainer: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radii.lg,
  },
  swipeableActions: {
    flexDirection: 'row',
  },
  swipeableAction: {
    width: 60,
    backgroundColor: colors.brandAmber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeableActionDelete: {
    backgroundColor: colors.brandRed,
  },
  swipeableContent: {
    flex: 1,
  },
});

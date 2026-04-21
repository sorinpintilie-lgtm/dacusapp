import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

/**
 * Empty state icon types
 */
export type EmptyStateIcon = 
  | 'cart' 
  | 'search' 
  | 'favorites' 
  | 'orders' 
  | 'products' 
  | 'wifi' 
  | 'error';

/**
 * Empty state configuration
 */
export interface EmptyStateConfig {
  icon: EmptyStateIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Icon component that renders different icons based on type
 */
function EmptyStateIcon({ type }: { type: EmptyStateIcon }) {
  const iconStyles = [
    styles.iconBase,
    type === 'cart' && styles.iconCart,
    type === 'search' && styles.iconSearch,
    type === 'favorites' && styles.iconFavorites,
    type === 'orders' && styles.iconOrders,
    type === 'products' && styles.iconProducts,
    type === 'wifi' && styles.iconWifi,
    type === 'error' && styles.iconError,
  ];

  const getIconContent = () => {
    switch (type) {
      case 'cart':
        return (
          <>
            <View style={styles.cartIconBody} />
            <View style={styles.cartIconHandle} />
            <View style={[styles.cartIconDot, styles.cartIconDot1]} />
            <View style={[styles.cartIconDot, styles.cartIconDot2]} />
          </>
        );
      case 'search':
        return (
          <>
            <View style={styles.searchIconCircle} />
            <View style={styles.searchIconHandle} />
          </>
        );
      case 'favorites':
        return (
          <>
            <View style={styles.favoriteIconHeart} />
            <View style={styles.favoriteIconPlus} />
          </>
        );
      case 'orders':
        return (
          <>
            <View style={styles.ordersIconBox} />
            <View style={styles.ordersIconCheck} />
          </>
        );
      case 'products':
        return (
          <>
            <View style={styles.productsIconBox} />
            <View style={styles.productsIconLine1} />
            <View style={styles.productsIconLine2} />
          </>
        );
      case 'wifi':
        return (
          <>
            <View style={styles.wifiIconDot} />
            <View style={styles.wifiIconArc1} />
            <View style={styles.wifiIconArc2} />
            <View style={styles.wifiIconSlash} />
          </>
        );
      case 'error':
        return (
          <>
            <View style={styles.errorIconCircle} />
            <View style={styles.errorIconLine} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={iconStyles}>
      {getIconContent()}
    </View>
  );
}

/**
 * Reusable empty state component
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateConfig) {
  return (
    <View style={styles.container}>
      <EmptyStateIcon type={icon} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={onAction}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Empty cart state
 */
export function EmptyCartState({ 
  onBrowseProducts 
}: { 
  onBrowseProducts?: () => void;
}) {
  return (
    <EmptyState
      icon="cart"
      title="Coșul tău este gol"
      description="Adaugă produse în coș pentru a continua cumpărăturile"
      actionLabel="Vezi produsele"
      onAction={onBrowseProducts}
    />
  );
}

/**
 * No search results state
 */
export function NoSearchResultsState({ 
  query, 
  onClearSearch,
  onBrowseAll 
}: { 
  query?: string;
  onClearSearch?: () => void;
  onBrowseAll?: () => void;
}) {
  return (
    <EmptyState
      icon="search"
      title="Niciun rezultat găsit"
      description={query 
        ? `Nu am găsit produse pentru "${query}"` 
        : "Nu am găsit produse care să corespundă căutării tale"}
      actionLabel={query ? "Șterge filtrele" : "Vezi toate produsele"}
      onAction={query ? onClearSearch : onBrowseAll}
    />
  );
}

/**
 * No favorites state
 */
export function NoFavoritesState({ 
  onBrowseProducts 
}: { 
  onBrowseProducts?: () => void;
}) {
  return (
    <EmptyState
      icon="favorites"
      title="Nu ai favorite"
      description="Salvează produsele preferate pentru a le găsi ușor mai târziu"
      actionLabel="Explorează produse"
      onAction={onBrowseProducts}
    />
  );
}

/**
 * No orders state
 */
export function NoOrdersState({ 
  onBrowseProducts 
}: { 
  onBrowseProducts?: () => void;
}) {
  return (
    <EmptyState
      icon="orders"
      title="Nicio comandă"
      description="Comenzile tale vor apărea aici după ce plasezi prima comandă"
      actionLabel="Începe cumpărăturile"
      onAction={onBrowseProducts}
    />
  );
}

/**
 * No products state
 */
export function NoProductsState({ 
  onRefresh 
}: { 
  onRefresh?: () => void;
}) {
  return (
    <EmptyState
      icon="products"
      title="Nu există produse"
      description="Încearcă să actualizezi pagina sau revino mai târziu"
      actionLabel="Actualizează"
      onAction={onRefresh}
    />
  );
}

/**
 * Network error state
 */
export function NetworkErrorState({ 
  onRetry 
}: { 
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="wifi"
      title="Fără conexiune la internet"
      description="Verifică conexiunea și încearcă din nou"
      actionLabel="Reîncearcă"
      onAction={onRetry}
    />
  );
}

/**
 * Generic error state
 */
export function ErrorState({ 
  message = "Ceva nu a mers bine",
  onRetry 
}: { 
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="error"
      title="Eroare"
      description={message}
      actionLabel="Reîncearcă"
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  actionButton: {
    backgroundColor: colors.brandRed,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },

  // Icon base
  iconBase: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cart icon
  iconCart: {
    backgroundColor: 'transparent',
  },
  cartIconBody: {
    width: 48,
    height: 36,
    borderWidth: 3,
    borderColor: colors.textSecondary,
    borderRadius: 6,
    position: 'absolute',
    bottom: 12,
  },
  cartIconHandle: {
    width: 24,
    height: 3,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
    top: 24,
    right: 16,
  },
  cartIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandRed,
    position: 'absolute',
  },
  cartIconDot1: {
    top: 32,
    right: 22,
  },
  cartIconDot2: {
    top: 38,
    right: 14,
  },

  // Search icon
  iconSearch: {},
  searchIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.textSecondary,
    position: 'absolute',
    top: 16,
    left: 20,
  },
  searchIconHandle: {
    width: 14,
    height: 3,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
    bottom: 20,
    right: 14,
    transform: [{ rotate: '45deg' }],
  },

  // Favorites icon
  iconFavorites: {},
  favoriteIconHeart: {
    width: 40,
    height: 36,
    backgroundColor: colors.brandRed,
    borderRadius: 20,
    position: 'absolute',
    top: 20,
    left: 20,
    transform: [{ rotate: '-45deg' }],
  },
  favoriteIconPlus: {
    width: 16,
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: 2,
    position: 'absolute',
    top: 36,
    left: 32,
  },

  // Orders icon
  iconOrders: {},
  ordersIconBox: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: colors.textSecondary,
    borderRadius: 8,
    position: 'absolute',
    top: 20,
    left: 20,
  },
  ordersIconCheck: {
    width: 16,
    height: 8,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.success,
    transform: [{ rotate: '-45deg' }],
    position: 'absolute',
    bottom: 24,
    right: 24,
  },

  // Products icon
  iconProducts: {},
  productsIconBox: {
    width: 44,
    height: 36,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    borderRadius: 4,
    position: 'absolute',
    top: 22,
    left: 18,
  },
  productsIconLine1: {
    width: 20,
    height: 2,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
    top: 28,
    left: 24,
  },
  productsIconLine2: {
    width: 14,
    height: 2,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
    top: 34,
    left: 24,
  },

  // WiFi icon
  iconWifi: {},
  wifiIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
    bottom: 16,
    left: 35,
  },
  wifiIconArc1: {
    width: 22,
    height: 11,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    borderBottomWidth: 0,
    borderRadius: 11,
    position: 'absolute',
    bottom: 22,
    left: 29,
  },
  wifiIconArc2: {
    width: 34,
    height: 17,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    borderBottomWidth: 0,
    borderRadius: 17,
    position: 'absolute',
    bottom: 28,
    left: 23,
  },
  wifiIconSlash: {
    width: 40,
    height: 2,
    backgroundColor: colors.brandRed,
    position: 'absolute',
    top: 40,
    left: 20,
    transform: [{ rotate: '-30deg' }],
  },

  // Error icon
  iconError: {},
  errorIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.brandRed,
    position: 'absolute',
    top: 20,
    left: 20,
  },
  errorIconLine: {
    width: 20,
    height: 3,
    backgroundColor: colors.brandRed,
    position: 'absolute',
    top: 38,
    left: 30,
    transform: [{ rotate: '45deg' }],
  },
});

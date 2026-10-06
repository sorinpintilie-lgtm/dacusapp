import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, type ListRenderItem } from 'react-native';

import type { CatalogProduct } from '../data/catalog';
import { useShopNavigation } from '../navigation/hooks';
import { useApp } from '../state/AppProvider';
import { colors, spacing } from '../theme/tokens';
import { EmptyState, ProductCard } from '../ui';
import { useStableCallback } from '../utils/useStableCallback';

const COLUMNS = 2;

export function WishlistScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const { openProduct } = useShopNavigation();
  const { wishlistProducts, wishlist, toggleWishlist, addToCart } = useApp();
  const cardWidth = (Math.min(width, 900) - spacing.md * 2 - spacing.sm) / COLUMNS;
  const addProductToCart = useStableCallback((productId: string) => addToCart(productId));

  const renderItem = useCallback<ListRenderItem<CatalogProduct>>(
    ({ item }) => (
      <ProductCard
        product={item}
        width={cardWidth}
        onPress={openProduct}
        onAddToCart={addProductToCart}
        wishlisted={wishlist.has(item.id)}
        onToggleWishlist={toggleWishlist}
      />
    ),
    [addProductToCart, cardWidth, openProduct, toggleWishlist, wishlist],
  );

  return (
    <FlatList
      data={wishlistProducts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <EmptyState
          icon="heart-outline"
          title="Nu ai produse favorite"
          message="Atinge inima de pe un produs ca să-l găsești rapid aici."
          actionLabel="Explorează produsele"
          onAction={() => navigation.navigate('MainTabs', { screen: 'CategoriesTab' })}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.canvas, flexGrow: 1 },
  row: { gap: spacing.sm },
});

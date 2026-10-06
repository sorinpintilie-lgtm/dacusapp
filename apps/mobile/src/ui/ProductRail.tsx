import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import type { CatalogProduct } from '../data/catalog';
import { spacing } from '../theme/tokens';
import { ProductCard } from './ProductCard';

export const RAIL_CARD_WIDTH = 150;
const GAP = spacing.sm;

type ProductRailProps = {
  products: CatalogProduct[];
  onPressProduct: (productId: string) => void;
  onAddToCart: (productId: string) => void;
  wishlist?: Set<string>;
  onToggleWishlist?: (productId: string) => void;
  cardWidth?: number;
};

/** Horizontal, virtualized row of product cards that snaps card by card. */
function ProductRailComponent({
  products,
  onPressProduct,
  onAddToCart,
  wishlist,
  onToggleWishlist,
  cardWidth = RAIL_CARD_WIDTH,
}: ProductRailProps) {
  const renderItem = useCallback<ListRenderItem<CatalogProduct>>(
    ({ item }) => (
      <ProductCard
        product={item}
        width={cardWidth}
        onPress={onPressProduct}
        onAddToCart={onAddToCart}
        wishlisted={wishlist?.has(item.id) ?? false}
        onToggleWishlist={onToggleWishlist}
      />
    ),
    [cardWidth, onAddToCart, onPressProduct, onToggleWishlist, wishlist],
  );

  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={Separator}
      initialNumToRender={3}
      maxToRenderPerBatch={4}
      windowSize={3}
      decelerationRate="fast"
      snapToInterval={cardWidth + GAP}
      snapToAlignment="start"
    />
  );
}

const Separator = () => <View style={styles.separator} />;

export const ProductRail = memo(ProductRailComponent);

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md },
  separator: { width: GAP },
});

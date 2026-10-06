import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useShopNavigation } from '../navigation/hooks';
import { useApp } from '../state/AppProvider';
import { colors, continuous, hitSlop, radii, shadows, spacing } from '../theme/tokens';
import {
  AppText,
  Button,
  EmptyState,
  fadeOut,
  hasImageUrl,
  IconButton,
  listLayout,
  ProductRail,
  ProductRow,
  QuantityStepper,
  SectionHeader,
  Touchable,
} from '../ui';
import { formatPrice, isProductInStock } from '../utils/catalogFilters';
import { useStableCallback } from '../utils/useStableCallback';

const SUGGESTION_LIMIT = 10;

export function CartScreen() {
  const navigation = useNavigation();
  const { openProduct } = useShopNavigation();
  const {
    products,
    cartItems,
    cartCount,
    cartTotal,
    deliveryEtaLabel,
    priceChangeExplanation,
    changeQuantity,
    removeCartItem,
    addToCart,
    checkoutError,
    savedCartLists,
    saveCurrentCartAsList,
    restoreCartList,
    removeSavedCartList,
    continueBrowsingProducts,
    wishlist,
    toggleWishlist,
  } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const addProductToCart = useStableCallback((productId: string) => addToCart(productId));

  // An empty cart suggests what was looked at recently, or popular items, instead of a dead end.
  const suggestions = useMemo(() => {
    const source = continueBrowsingProducts.length > 0 ? continueBrowsingProducts : products;
    return source
      .filter((item) => isProductInStock(item) && hasImageUrl(item.thumbnailUrl ?? item.imageUrl))
      .slice(0, SUGGESTION_LIMIT);
  }, [continueBrowsingProducts, products]);

  const savedLists =
    savedCartLists.length > 0 ? (
      <View style={styles.group}>
        <AppText variant="title3">Liste salvate</AppText>
        <View style={styles.panel}>
          {savedCartLists.slice(0, 5).map((list, index) => (
            <View key={list.id} style={[styles.listRow, index > 0 && styles.divider]}>
              <Touchable
                onPress={() => restoreCartList(list.id)}
                pressedScale={0.98}
                style={styles.listMain}
                accessibilityLabel={`Restaurează lista ${list.name}`}
              >
                <Ionicons name="bookmark-outline" size={20} color={colors.textPrimary} />
                <View style={styles.flex}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {list.name}
                  </AppText>
                  <AppText variant="footnote" tone="secondary">
                    {new Date(list.createdAt).toLocaleDateString('ro-RO')}, {list.lines.length}{' '}
                    {list.lines.length === 1 ? 'produs' : 'produse'}
                  </AppText>
                </View>
              </Touchable>
              <IconButton
                icon="trash-outline"
                accessibilityLabel={`Șterge lista ${list.name}`}
                onPress={() => removeSavedCartList(list.id)}
                size={36}
                color={colors.textTertiary}
              />
            </View>
          ))}
        </View>
        <AppText variant="footnote" tone="tertiary">
          Restaurarea unei liste înlocuiește conținutul coșului.
        </AppText>
      </View>
    ) : null;

  if (cartItems.length === 0) {
    return (
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, styles.emptyContent]}
      >
        <EmptyState
          icon="bag-handle-outline"
          title="Coșul tău e gol"
          message="Adaugă produse și le găsești aici când ești gata de comandă."
          actionLabel="Începe cumpărăturile"
          onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab', params: { screen: 'Home' } })}
        />
        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            <SectionHeader
              title={continueBrowsingProducts.length > 0 ? 'Văzute recent' : 'Ți-ar putea plăcea'}
              style={styles.gutter}
            />
            <ProductRail
              products={suggestions}
              onPressProduct={openProduct}
              onAddToCart={addProductToCart}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
            />
          </View>
        ) : null}
        <View style={styles.gutter}>{savedLists}</View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, styles.gutter, styles.withBar]}
      >
        {checkoutError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <AppText variant="subhead" tone="danger" style={styles.flex}>
              {checkoutError}
            </AppText>
          </View>
        ) : null}

        <View>
          {cartItems.map((item, index) => (
            <Animated.View
              key={`${item.productId}-${item.variantId ?? 'default'}`}
              exiting={fadeOut}
              layout={listLayout}
              style={index > 0 ? styles.divider : null}
            >
              <ProductRow
                product={item.product}
                onPress={openProduct}
                price={item.unitPriceRon}
                meta={item.variantName ? `Variantă: ${item.variantName}` : undefined}
                thumbSize={84}
                right={
                  <IconButton
                    icon="close"
                    accessibilityLabel={`Elimină ${item.product.name}`}
                    onPress={() => removeCartItem(item.productId, item.variantId)}
                    size={32}
                    color={colors.textTertiary}
                  />
                }
              >
                <View style={styles.itemFooter}>
                  <QuantityStepper
                    value={item.quantity}
                    minIcon="trash-outline"
                    size="sm"
                    onDecrement={() =>
                      item.quantity <= 1
                        ? removeCartItem(item.productId, item.variantId)
                        : changeQuantity(item.productId, item.variantId, -1)
                    }
                    onIncrement={() => changeQuantity(item.productId, item.variantId, 1)}
                  />
                  <AppText variant="headline" style={styles.lineTotal}>
                    {formatPrice(item.unitPriceRon * item.quantity)}
                  </AppText>
                </View>
              </ProductRow>
            </Animated.View>
          ))}
        </View>

        <Animated.View layout={listLayout} style={styles.panel}>
          <View style={styles.summary}>
            <SummaryRow label={`Produse (${cartCount})`} value={formatPrice(cartTotal)} />
            <SummaryRow label="Livrare" value="Se calculează la plată" muted />
            <View style={styles.summaryDivider} />
            <View style={styles.totalRow}>
              <AppText variant="headline">Total</AppText>
              <AppText variant="title2">{formatPrice(cartTotal)}</AppText>
            </View>
            <View style={styles.eta}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <AppText variant="footnote" tone="secondary" style={styles.flex}>
                {deliveryEtaLabel}
              </AppText>
            </View>
            {priceChangeExplanation ? (
              <AppText variant="footnote" tone="warning">
                {priceChangeExplanation}
              </AppText>
            ) : null}
          </View>
        </Animated.View>

        <Touchable onPress={saveCurrentCartAsList} hitSlop={hitSlop} pressedScale={0.97} style={styles.saveList}>
          <Ionicons name="bookmark-outline" size={18} color={colors.textPrimary} />
          <AppText variant="subheadMedium">Salvează coșul ca listă</AppText>
        </Touchable>

        {savedLists}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: spacing.sm }]}>
        <View>
          <AppText variant="caption" tone="secondary">
            Total
          </AppText>
          <AppText variant="title2">{formatPrice(cartTotal)}</AppText>
        </View>
        <Button
          title="Finalizează comanda"
          icon="arrow-forward"
          iconPosition="right"
          size="lg"
          style={styles.flex}
          onPress={() => navigation.navigate('Checkout')}
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="body" tone={muted ? 'secondary' : 'primary'}>
        {label}
      </AppText>
      <AppText variant={muted ? 'body' : 'bodyMedium'} tone={muted ? 'secondary' : 'primary'}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.xl, paddingTop: spacing.xs },
  emptyContent: { paddingBottom: spacing.xxxl },
  withBar: { paddingBottom: 120 },
  gutter: { paddingHorizontal: spacing.md },
  suggestions: { gap: spacing.sm },
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  errorCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerTint,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.md,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineTotal: { fontVariant: ['tabular-nums'] },
  panel: { backgroundColor: colors.well, borderRadius: radii.md, ...continuous, overflow: 'hidden' },
  summary: { padding: spacing.md, gap: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  saveList: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', paddingVertical: spacing.xxs },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs },
  listMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.bar,
  },
});

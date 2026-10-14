import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShopNavigation } from '../navigation/hooks';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppProvider';
import { colors, continuous, radii, shadows, spacing } from '../theme/tokens';
import {
  AppText,
  Badge,
  Button,
  Chip,
  discountPercent,
  displayBrand,
  EmptyState,
  enterUp,
  hasImageUrl,
  HeartButton,
  IconButton,
  PriceTag,
  ProductRail,
  SectionHeader,
  ProductImage,
  StockLine,
  Touchable,
  useToast,
} from '../ui';
import { formatPrice, getStockBadgeTone } from '../utils/catalogFilters';
import { getBundleProducts, getSimilarProducts, getUpsellProducts } from '../utils/recommendations';
import { useStableCallback } from '../utils/useStableCallback';
import { productCount } from '../utils/string';

const STORE_URL = 'https://dacus.ro/products/';
const ADDED_FEEDBACK_MS = 1600;
const DESCRIPTION_PREVIEW_LINES = 4;

export function ProductScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Product'>>();
  const { productId } = route.params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const { openProduct } = useShopNavigation();
  const {
    products,
    productsById,
    categories,
    wishlist,
    toggleWishlist,
    addToCart,
    backInStockSubscriptions,
    toggleBackInStockAlert,
    trackProductView,
  } = useApp();

  const product = productsById.get(productId);
  const variants = useMemo(
    () => (product?.variants ?? []).filter((variant) => variant.name && variant.name !== 'Default Title'),
    [product?.variants],
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    () => (product?.variants?.find((variant) => variant.inStock) ?? product?.variants?.[0])?.id,
  );
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    trackProductView(productId);
  }, [productId, trackProductView]);

  useEffect(() => () => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
  }, []);

  const imageHeight = Math.min(width, 520);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // The photo drifts up slower than the page (parallax) and stretches when pulled down.
  const imageStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.35 },
        { scale: y < 0 ? 1 + -y / imageHeight : 1 },
      ],
    };
  });
  // The solid header with the product name appears once the photo has scrolled away.
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [imageHeight - 160, imageHeight - 90], [0, 1], Extrapolation.CLAMP),
  }));

  const selectedVariant = product?.variants?.find((variant) => variant.id === selectedVariantId);
  const price = selectedVariant?.priceRon ?? product?.priceRon ?? 0;
  const inStock = selectedVariant
    ? selectedVariant.inStock
    : product
      ? getStockBadgeTone(product.stockLabel) !== 'outOfStock'
      : false;
  const wishlisted = wishlist.has(productId);
  const alertActive = backInStockSubscriptions.has(productId);

  const similarProducts = useMemo(() => (product ? getSimilarProducts(product, products) : []), [product, products]);
  const upsellProducts = useMemo(
    () => (product ? getUpsellProducts(product, products, new Set(similarProducts.map((item) => item.id))) : []),
    [product, products, similarProducts],
  );
  const bundleProducts = useMemo(() => (product ? getBundleProducts(product, products) : []), [product, products]);
  const categoryName = categories.find((category) => category.id === product?.categoryId)?.name;

  const shareProduct = useStableCallback(() => {
    if (!product) return;
    const url = product.handle ? `${STORE_URL}${product.handle}` : '';
    void Share.share({ message: url ? `${product.name}\n${url}` : product.name }).catch(() => undefined);
  });

  const addProductToCart = useStableCallback((id: string) => addToCart(id));

  const addMainProduct = () => {
    if (!product) return;
    addToCart(product.id, selectedVariantId);
    setJustAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS);
  };

  const floatingButtons = (
    <View style={[styles.floatingRow, { top: insets.top + spacing.xs }]} pointerEvents="box-none">
      <IconButton icon="chevron-back" accessibilityLabel="Înapoi" onPress={() => navigation.goBack()} variant="floating" />
      {product ? (
        <View style={styles.floatingRight}>
          <IconButton icon="share-outline" accessibilityLabel="Distribuie" onPress={shareProduct} variant="floating" />
          <HeartButton active={wishlisted} onPress={() => toggleWishlist(productId)} size={40} floating />
        </View>
      ) : null}
    </View>
  );

  if (!product) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 56 }]}>
        <EmptyState
          icon="cube-outline"
          title="Produsul nu mai este disponibil"
          message="Este posibil să fi fost retras din catalog."
          actionLabel="Înapoi"
          onAction={() => navigation.goBack()}
        />
        {floatingButtons}
      </View>
    );
  }

  const imageUrl = product.imageUrl ?? product.thumbnailUrl;
  const discount = selectedVariant ? 0 : discountPercent(product.priceRon, product.oldPriceRon);
  const savings = discount > 0 && product.oldPriceRon ? product.oldPriceRon - product.priceRon : 0;
  const description = product.description?.trim();
  const brand = displayBrand(product.brand);

  const addBundle = () => {
    bundleProducts.forEach((item) => addToCart(item.id, undefined, { silent: true }));
    showToast(`Am adăugat în coș ${productCount(bundleProducts.length)}.`);
  };

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 104 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.media, { height: imageHeight + spacing.xl }, imageStyle]}>
          <Touchable
            onPress={() => (hasImageUrl(imageUrl) ? navigation.navigate('ImageViewer', { uri: imageUrl }) : undefined)}
            pressedScale={1}
            accessibilityLabel="Mărește imaginea"
            style={[styles.mediaPress, { paddingTop: insets.top + 48 }]}
          >
            <View style={styles.blend}>
              <ProductImage uri={imageUrl} placeholderUri={product.thumbnailUrl} iconSize={56} />
            </View>
          </Touchable>
        </Animated.View>

        <View style={styles.body}>
          <Animated.View entering={enterUp(0)} style={styles.titleBlock}>
            {brand || categoryName ? (
              <AppText variant="footnote" tone="secondary">
                {[brand, categoryName].filter(Boolean).join(' · ')}
              </AppText>
            ) : null}
            <AppText variant="title2" selectable>
              {product.name}
            </AppText>
          </Animated.View>

          <Animated.View entering={enterUp(1)} style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <PriceTag price={price} oldPrice={selectedVariant ? undefined : product.oldPriceRon} size="lg" />
              {discount > 0 ? <Badge label={`-${discount}%`} tone="brand" /> : null}
            </View>
            {savings > 0 ? (
              <AppText variant="subheadMedium" tone="brand">
                Economisești {formatPrice(savings)}
              </AppText>
            ) : null}
            <View style={styles.metaRow}>
              <StockLine label={selectedVariant ? 'În stoc' : product.stockLabel} inStock={inStock} />
              {product.sku ? (
                <AppText variant="footnote" tone="secondary" selectable>
                  Cod: {product.sku}
                </AppText>
              ) : null}
            </View>
          </Animated.View>

          {variants.length > 0 ? (
            <Animated.View entering={enterUp(2)} style={styles.group}>
              <AppText variant="headline">Variantă: {selectedVariant?.name ?? '-'}</AppText>
              <View style={styles.wrap}>
                {variants.map((variant) => (
                  <Chip
                    key={variant.id}
                    label={variant.name}
                    selected={variant.id === selectedVariantId}
                    disabled={!variant.inStock}
                    onPress={() => setSelectedVariantId(variant.id)}
                  />
                ))}
              </View>
            </Animated.View>
          ) : null}

          {!inStock ? (
            <Button
              title={alertActive ? 'Te anunțăm când revine în stoc' : 'Anunță-mă când revine în stoc'}
              icon={alertActive ? 'notifications' : 'notifications-outline'}
              variant={alertActive ? 'secondary' : 'outline'}
              onPress={() => toggleBackInStockAlert(product.id)}
            />
          ) : null}

          <Animated.View entering={enterUp(3)} style={styles.perks}>
            <Perk icon="cube-outline" title="Livrare prin curier" text="În 24-48h în majoritatea localităților" />
            <Perk icon="return-down-back-outline" title="Retur în 14 zile" text="Conform politicii de retur Dacus" />
            <Perk icon="lock-closed-outline" title="Plată securizată" text="Plătești în pagina securizată a magazinului" />
          </Animated.View>

          {description ? (
            <View style={styles.group}>
              <AppText variant="title3">Descriere</AppText>
              <AppText
                variant="body"
                tone="secondary"
                numberOfLines={descriptionExpanded ? undefined : DESCRIPTION_PREVIEW_LINES}
                selectable
              >
                {description}
              </AppText>
              {description.length > 180 ? (
                <Touchable
                  onPress={() => setDescriptionExpanded((current) => !current)}
                  pressedScale={0.97}
                  style={styles.more}
                  accessibilityLabel={descriptionExpanded ? 'Arată mai puțin' : 'Citește tot'}
                >
                  <AppText variant="subheadMedium">{descriptionExpanded ? 'Arată mai puțin' : 'Citește tot'}</AppText>
                  <Ionicons name={descriptionExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textPrimary} />
                </Touchable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.group}>
            <AppText variant="title3">Detalii</AppText>
            <View style={styles.specs}>
              <Spec label="Brand" value={product.brand || 'Dacus'} />
              {categoryName ? <Spec label="Categorie" value={categoryName} /> : null}
              {product.sku ? <Spec label="Cod produs" value={product.sku} /> : null}
              <Spec label="Disponibilitate" value={inStock ? 'În stoc' : 'Stoc epuizat'} />
            </View>
          </View>
        </View>

        {bundleProducts.length > 0 ? (
          <View style={styles.railBlock}>
            <SectionHeader
              title="Cumpărate des împreună"
              subtitle="Același brand, din alte categorii"
              actionLabel="Adaugă toate"
              onAction={addBundle}
              style={styles.gutter}
            />
            <ProductRail products={bundleProducts} onPressProduct={openProduct} onAddToCart={addProductToCart} />
          </View>
        ) : null}

        {similarProducts.length > 0 ? (
          <View style={styles.railBlock}>
            <SectionHeader title="Produse similare" style={styles.gutter} />
            <ProductRail products={similarProducts} onPressProduct={openProduct} onAddToCart={addProductToCart} />
          </View>
        ) : null}

        {upsellProducts.length > 0 ? (
          <View style={styles.railBlock}>
            <SectionHeader title="Îți mai recomandăm" style={styles.gutter} />
            <ProductRail products={upsellProducts} onPressProduct={openProduct} onAddToCart={addProductToCart} />
          </View>
        ) : null}
      </Animated.ScrollView>

      <Animated.View style={[styles.solidHeader, { height: insets.top + 56 }, headerStyle]} pointerEvents="none">
        <AppText variant="headline" numberOfLines={1} style={[styles.solidTitle, { marginTop: insets.top }]}>
          {product.name}
        </AppText>
      </Animated.View>
      {floatingButtons}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.bottomPrice}>
          <PriceTag price={price} size="md" />
          {discount > 0 && product.oldPriceRon ? (
            <AppText variant="caption" tone="tertiary" style={styles.strike}>
              {formatPrice(product.oldPriceRon)}
            </AppText>
          ) : null}
        </View>
        {inStock ? (
          <Button
            title={justAdded ? 'Adăugat în coș' : 'Adaugă în coș'}
            icon={justAdded ? 'checkmark-circle' : 'bag-add-outline'}
            variant={justAdded ? 'dark' : 'primary'}
            size="lg"
            style={styles.bottomButton}
            onPress={addMainProduct}
          />
        ) : (
          <Button
            title={alertActive ? 'Alertă activă' : 'Anunță-mă'}
            icon={alertActive ? 'notifications' : 'notifications-outline'}
            size="lg"
            variant="dark"
            style={styles.bottomButton}
            onPress={() => toggleBackInStockAlert(product.id)}
          />
        )}
      </View>
    </View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Perk({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.perk}>
      <Ionicons name={icon} size={20} color={colors.textPrimary} />
      <View style={styles.perkTexts}>
        <AppText variant="subheadMedium">{title}</AppText>
        <AppText variant="footnote" tone="secondary">
          {text}
        </AppText>
      </View>
    </View>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <AppText variant="subhead" tone="secondary" style={styles.specLabel}>
        {label}
      </AppText>
      <AppText variant="subheadMedium" style={styles.specValue} selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  gutter: { paddingHorizontal: spacing.md },
  media: { backgroundColor: colors.well, isolation: 'isolate' },
  // The pressable is its own layer (it scales), so it carries the grey too: the photo multiplies onto it.
  mediaPress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.well,
    isolation: 'isolate',
  },
  blend: { width: '100%', height: '100%', mixBlendMode: 'multiply' },
  body: {
    marginTop: -spacing.xl,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...continuous,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  titleBlock: { gap: spacing.xxs },
  priceBlock: { gap: spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  perks: {
    backgroundColor: colors.well,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.md,
    gap: spacing.md,
  },
  perk: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  perkTexts: { flex: 1, gap: 1 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 },
  specs: { gap: spacing.sm },
  spec: { flexDirection: 'row', gap: spacing.md },
  specLabel: { width: 120 },
  specValue: { flex: 1 },
  railBlock: { gap: spacing.sm, marginTop: spacing.xxl },
  solidHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    justifyContent: 'center',
  },
  solidTitle: { marginHorizontal: 116, textAlign: 'center' },
  floatingRow: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingRight: { flexDirection: 'row', gap: spacing.xs },
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
  bottomPrice: { gap: 0, minWidth: 96 },
  strike: { textDecorationLine: 'line-through' },
  bottomButton: { flex: 1 },
});

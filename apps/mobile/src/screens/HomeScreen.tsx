import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions, type ListRenderItem } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { openAccountScreen } from '../navigation/navigationRef';
import { useShopNavigation } from '../navigation/hooks';
import type { HomeStackParamList } from '../navigation/types';
import { useApp } from '../state/AppProvider';
import { colors, continuous, fonts, radii, shadows, spacing } from '../theme/tokens';
import {
  AppText,
  enterUp,
  hasImageUrl,
  IconButton,
  ProductRail,
  SearchTrigger,
  SectionHeader,
  sizedImageUrl,
  Touchable,
} from '../ui';
import { RoofMark } from '../ui/RoofMark';
import { isProductInStock } from '../utils/catalogFilters';
import { useStableCallback } from '../utils/useStableCallback';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../../assets/dacus-logo.png');

const SHELF_LIMIT = 12;
const HERO_COUNT = 4;
const BRAND_ROW_HEIGHT = 44;
const SEARCH_HEIGHT = 46;
const HEADER_GAP = spacing.xs;
/** How far the header slides up: the logo row leaves, the search bar stays. */
const COLLAPSE_DISTANCE = BRAND_ROW_HEIGHT + HEADER_GAP;

type HomeRow =
  | { type: 'hero'; key: string }
  | { type: 'categories'; key: string }
  | { type: 'recent'; key: string }
  | { type: 'deals'; key: string; products: CatalogProduct[] }
  | { type: 'loyalty'; key: string }
  | { type: 'recommended'; key: string; products: CatalogProduct[] }
  | { type: 'shelf'; key: string; category: CatalogCategory; products: CatalogProduct[] };

/** Products worth showing first: in stock and with a photo. */
const showcase = (items: CatalogProduct[], limit: number) => {
  const picked: CatalogProduct[] = [];
  for (const item of items) {
    if (isProductInStock(item) && hasImageUrl(item.thumbnailUrl ?? item.imageUrl)) picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
};

/** An even spread over the whole catalog, so recommendations aren't all from the first category. */
const spread = (items: CatalogProduct[], limit: number) => {
  const pool = items.filter((item) => isProductInStock(item) && hasImageUrl(item.thumbnailUrl ?? item.imageUrl));
  if (pool.length <= limit) return pool;
  const step = pool.length / limit;
  return Array.from({ length: limit }, (_, index) => pool[Math.floor(index * step + step / 2)] as CatalogProduct);
};

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<HomeRow>);

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const rootNavigation = useNavigation();
  const { openProduct, openSearch } = useShopNavigation();
  const {
    products,
    featuredCategories,
    orderedCategories,
    homeSections,
    countByCategory,
    continueBrowsingProducts,
    wishlist,
    toggleWishlist,
    addToCart,
    accountUser,
    loyalty,
    unreadInboxCount,
    trackCategoryView,
  } = useApp();

  const listRef = useAnimatedRef<FlatList<HomeRow>>();
  useScrollToTop(listRef as unknown as React.RefObject<FlatList<HomeRow>>);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const addProductToCart = useStableCallback((productId: string) => addToCart(productId));

  const openCategory = useStableCallback((category: CatalogCategory) => {
    trackCategoryView(category.id);
    navigation.navigate('ProductList', { categoryId: category.id, title: category.name });
  });

  const rows = useMemo<HomeRow[]>(() => {
    const deals = products.filter((item) => (item.oldPriceRon ?? 0) > item.priceRon && isProductInStock(item));
    return [
      { type: 'hero', key: 'hero' },
      { type: 'categories', key: 'categories' },
      ...(continueBrowsingProducts.length > 0 ? [{ type: 'recent' as const, key: 'recent' }] : []),
      ...(deals.length >= 3 ? [{ type: 'deals' as const, key: 'deals', products: deals.slice(0, SHELF_LIMIT) }] : []),
      { type: 'loyalty', key: 'loyalty' },
      { type: 'recommended', key: 'recommended', products: spread(products, SHELF_LIMIT) },
      ...homeSections.map((section) => ({
        type: 'shelf' as const,
        key: `shelf-${section.category.id}`,
        category: section.category,
        products: showcase(section.products, SHELF_LIMIT),
      })),
    ];
  }, [continueBrowsingProducts.length, homeSections, products]);

  const rail = (items: CatalogProduct[]) => (
    <ProductRail
      products={items}
      onPressProduct={openProduct}
      onAddToCart={addProductToCart}
      wishlist={wishlist}
      onToggleWishlist={toggleWishlist}
    />
  );

  const renderRow: ListRenderItem<HomeRow> = ({ item, index }) => {
    let content: React.ReactNode = null;
    switch (item.type) {
      case 'hero':
        content = (
          <HeroCarousel
            categories={featuredCategories.slice(0, HERO_COUNT)}
            countByCategory={countByCategory}
            onOpen={openCategory}
          />
        );
        break;
      case 'categories':
        content = (
          <View style={styles.block}>
            <SectionHeader
              title="Categorii"
              onAction={() => rootNavigation.navigate('MainTabs', { screen: 'CategoriesTab' })}
              style={styles.gutter}
            />
            <CategoryShortcuts categories={orderedCategories} onOpen={openCategory} />
          </View>
        );
        break;
      case 'recent':
        content = (
          <View style={styles.block}>
            <SectionHeader title="Văzute recent" style={styles.gutter} />
            {rail(continueBrowsingProducts)}
          </View>
        );
        break;
      case 'deals':
        content = (
          <View style={styles.block}>
            <SectionHeader title="Reduceri" subtitle="Prețuri mai mici, cât sunt pe stoc" style={styles.gutter} />
            {rail(item.products)}
          </View>
        );
        break;
      case 'loyalty':
        content = (
          <LoyaltyBanner
            signedIn={!!accountUser}
            points={loyalty.points}
            tier={loyalty.tier}
            onPress={() =>
              accountUser ? rootNavigation.navigate('MainTabs', { screen: 'LoyaltyTab' }) : rootNavigation.navigate('Login')
            }
          />
        );
        break;
      case 'recommended':
        content = (
          <View style={styles.block}>
            <SectionHeader title="Recomandate pentru tine" style={styles.gutter} />
            {rail(item.products)}
          </View>
        );
        break;
      case 'shelf':
        content = (
          <View style={styles.block}>
            <SectionHeader
              title={item.category.name}
              onAction={() => openCategory(item.category)}
              style={styles.gutter}
            />
            {rail(item.products)}
          </View>
        );
        break;
    }
    return <Animated.View entering={enterUp(index)}>{content}</Animated.View>;
  };

  const headerHeight = insets.top + spacing.xs + BRAND_ROW_HEIGHT + HEADER_GAP + SEARCH_HEIGHT + spacing.sm;

  return (
    <View style={styles.screen}>
      <AnimatedFlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + spacing.xs }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        windowSize={5}
      />
      <HomeHeader
        scrollY={scrollY}
        topInset={insets.top}
        unread={accountUser ? unreadInboxCount : 0}
        onSearch={() => openSearch()}
        onInbox={() => openAccountScreen('Inbox')}
      />
    </View>
  );
}

type HomeHeaderProps = {
  scrollY: SharedValue<number>;
  topInset: number;
  unread: number;
  onSearch: () => void;
  onInbox: () => void;
};

/** Logo row slides away as you scroll; the search bar docks at the top. */
function HomeHeader({ scrollY, topInset, unread, onSearch, onInbox }: HomeHeaderProps) {
  const slideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -interpolate(scrollY.value, [0, COLLAPSE_DISTANCE], [0, COLLAPSE_DISTANCE], Extrapolation.CLAMP) },
    ],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_DISTANCE * 0.7], [1, 0], Extrapolation.CLAMP),
  }));
  const dividerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_DISTANCE, COLLAPSE_DISTANCE + 24], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.headerHost} pointerEvents="box-none">
      <Animated.View style={[styles.header, { paddingTop: topInset + spacing.xs }, slideStyle]}>
        <Animated.View style={[styles.brandRow, brandStyle]}>
          <Image source={logo} style={styles.logo} contentFit="contain" accessibilityLabel="Dacus" />
          <IconButton icon="notifications-outline" accessibilityLabel="Notificări" onPress={onInbox} badge={unread} />
        </Animated.View>
        <SearchTrigger placeholder="Caută produse, branduri, coduri" onPress={onSearch} />
        <Animated.View style={[styles.divider, dividerStyle]} />
      </Animated.View>
      {/* Keeps the status bar area solid while the header slides under it. */}
      <View style={[styles.statusCover, { height: topInset }]} />
    </View>
  );
}

type HeroCarouselProps = {
  categories: CatalogCategory[];
  countByCategory: Map<string, number>;
  onOpen: (category: CatalogCategory) => void;
};

const HeroCarousel = memo(function HeroCarousel({ categories, countByCategory, onOpen }: HeroCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 640) - spacing.md * 2;
  const cardHeight = Math.round(cardWidth * 0.58);
  const step = cardWidth + spacing.sm;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  if (categories.length === 0) return null;

  return (
    <View style={styles.heroBlock}>
      <Animated.ScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        contentContainerStyle={styles.heroContent}
      >
        {categories.map((category) => (
          <Touchable
            key={category.id}
            onPress={() => onOpen(category)}
            pressedScale={0.98}
            accessibilityLabel={`${category.name}, ${(countByCategory.get(category.id) ?? 0).toLocaleString('ro-RO')} produse`}
            style={[styles.heroCard, { width: cardWidth, height: cardHeight }]}
          >
            {hasImageUrl(category.imageUrl) ? (
              <Image
                source={sizedImageUrl(category.imageUrl, cardWidth)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
              />
            ) : null}
            <LinearGradient
              colors={['rgba(12,11,10,0)', 'rgba(12,11,10,0.15)', 'rgba(12,11,10,0.78)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroText}>
              <AppText variant="display" tone="inverse" numberOfLines={2}>
                {category.name}
              </AppText>
              <View style={styles.heroMeta}>
                <AppText variant="callout" tone="inverseMuted">
                  {(countByCategory.get(category.id) ?? 0).toLocaleString('ro-RO')} produse
                </AppText>
                <View style={styles.heroCta}>
                  <AppText variant="footnote" style={styles.heroCtaText}>
                    Descoperă
                  </AppText>
                </View>
              </View>
            </View>
          </Touchable>
        ))}
      </Animated.ScrollView>
      {categories.length > 1 ? (
        <View style={styles.dots}>
          {categories.map((category, index) => (
            <PagerDot key={category.id} index={index} step={step} scrollX={scrollX} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

function PagerDot({ index, step, scrollX }: { index: number; step: number; scrollX: SharedValue<number> }) {
  // The current page's dot stretches into a bar; neighbours shrink back as you swipe.
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / step - index);
    const active = 1 - Math.min(distance, 1);
    return {
      width: 6 + active * 16,
      backgroundColor: active > 0.5 ? colors.ink : colors.lineStrong,
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function CategoryShortcuts({ categories, onOpen }: { categories: CatalogCategory[]; onOpen: (category: CatalogCategory) => void }) {
  // Two rows that scroll together, so every category is one swipe away.
  const columns = useMemo(() => {
    const result: CatalogCategory[][] = [];
    for (let index = 0; index < categories.length; index += 2) {
      result.push(categories.slice(index, index + 2));
    }
    return result;
  }, [categories]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
      {columns.map((column) => (
        <View key={column[0]?.id} style={styles.shortcutColumn}>
          {column.map((category) => (
            <Touchable
              key={category.id}
              onPress={() => onOpen(category)}
              pressedScale={0.95}
              haptic="selection"
              accessibilityLabel={category.name}
              style={styles.shortcut}
            >
              <View style={styles.shortcutThumb}>
                {hasImageUrl(category.imageUrl) ? (
                  <Image source={sizedImageUrl(category.imageUrl, 36)} style={styles.shortcutImage} contentFit="cover" />
                ) : null}
              </View>
              <AppText variant="subheadMedium" numberOfLines={1} style={styles.shortcutLabel}>
                {category.name}
              </AppText>
            </Touchable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

type LoyaltyBannerProps = {
  signedIn: boolean;
  points: number;
  tier: string;
  onPress: () => void;
};

function LoyaltyBanner({ signedIn, points, tier, onPress }: LoyaltyBannerProps) {
  return (
    <View style={styles.gutter}>
      <Touchable onPress={onPress} pressedScale={0.98} style={styles.loyalty} accessibilityLabel="Program de fidelitate">
        <View style={styles.loyaltyMark} pointerEvents="none">
          <RoofMark width={150} color={colors.brand} strokeWidth={8} />
        </View>
        <View style={styles.loyaltyTexts}>
          <AppText variant="label" tone="inverseMuted">
            {signedIn ? `NIVEL ${tier.toUpperCase()}` : 'PROGRAM DE FIDELITATE'}
          </AppText>
          <AppText variant="title1" tone="inverse">
            {signedIn ? `${points.toLocaleString('ro-RO')} puncte` : 'Puncte la fiecare comandă'}
          </AppText>
          <AppText variant="subhead" tone="inverseMuted">
            {signedIn ? '100 de puncte înseamnă 5 RON reducere.' : '1 punct pentru fiecare leu. 100 de puncte = 5 RON.'}
          </AppText>
        </View>
        {/* Looks like a button; the whole card is the tap target. */}
        <View style={styles.loyaltyCta}>
          <AppText variant="footnote" style={styles.loyaltyCtaText}>
            {signedIn ? 'Vezi cardul' : 'Intră în cont'}
          </AppText>
          <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
        </View>
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing.xxxl, gap: spacing.xxl },
  gutter: { paddingHorizontal: spacing.md },
  block: { gap: spacing.sm },

  headerHost: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: HEADER_GAP,
  },
  brandRow: { height: BRAND_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 112, height: 36 },
  divider: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  statusCover: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.canvas },

  heroBlock: { gap: spacing.sm },
  heroContent: { paddingHorizontal: spacing.md, gap: spacing.sm },
  heroCard: {
    borderRadius: radii.lg,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.charcoal,
    justifyContent: 'flex-end',
  },
  heroText: { padding: spacing.lg, gap: spacing.xs },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroCta: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  heroCtaText: { color: colors.textPrimary, fontFamily: fonts.semibold },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },

  shortcuts: { paddingHorizontal: spacing.md, gap: spacing.xs },
  shortcutColumn: { gap: spacing.xs },
  shortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 48,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radii.md,
    ...continuous,
    backgroundColor: colors.well,
    maxWidth: 230,
  },
  shortcutThumb: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.wellStrong,
  },
  shortcutImage: { width: '100%', height: '100%' },
  shortcutLabel: { flexShrink: 1 },

  loyalty: {
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    ...continuous,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.float,
  },
  loyaltyMark: { position: 'absolute', top: -14, right: -26, opacity: 0.95 },
  loyaltyTexts: { gap: spacing.xxs, paddingRight: 90 },
  loyaltyCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    ...continuous,
    backgroundColor: colors.surface,
  },
  loyaltyCtaText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
});

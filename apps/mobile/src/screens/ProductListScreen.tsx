import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogProduct } from '../data/catalog';
import { useShopNavigation } from '../navigation/hooks';
import type { ProductListParams } from '../navigation/types';
import { COMPARE_PRODUCTS_LIMIT, useApp } from '../state/AppProvider';
import {
  countActiveFilters,
  DEFAULT_PRODUCT_FILTERS,
  PRICE_LABELS,
  SEARCH_DEFAULT_FILTERS,
  SORT_LABELS,
  type ProductListFilters,
} from '../state/productListFilters';
import { colors, continuous, radii, shadows, spacing } from '../theme/tokens';
import {
  AppText,
  Button,
  Chip,
  EmptyState,
  IconButton,
  ListItem,
  ProductCard,
  ProductRow,
  Sheet,
  StockLine,
  Touchable,
} from '../ui';
import {
  filterProducts,
  formatPrice,
  isProductInStock,
  type PriceFilterOption,
  type SortOption,
} from '../utils/catalogFilters';
import { searchProducts } from '../utils/search';
import { departmentProducts } from '../data/departments';
import { useStableCallback } from '../utils/useStableCallback';
import { productCount } from '../utils/string';

const COLUMNS = 2;
const GRID_GAP = spacing.sm;
const PRICE_OPTIONS: PriceFilterOption[] = [
  'toate',
  'sub200',
  'intre200si500',
  'intre500si1000',
  'peste1000',
];
const SORT_OPTIONS: SortOption[] = ['relevanta', 'pretCrescator', 'pretDescrescator', 'numeAZ'];

const barEnter = FadeInDown.duration(220).reduceMotion(ReduceMotion.System);
const barExit = FadeOutDown.duration(160).reduceMotion(ReduceMotion.System);

/** The list (category or ranked search matches) narrowed by the filters; the ranking survives "Relevanță". */
const computeResults = (
  scope: CatalogProduct[],
  filters: ProductListFilters,
  wishlist: Set<string>,
) => {
  const matches = filterProducts(scope, { ...filters, query: '' });
  return filters.onlyFavorites ? matches.filter((product) => wishlist.has(product.id)) : matches;
};

export function ProductListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params ?? {}) as ProductListParams;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { openProduct, openSearch } = useShopNavigation();
  const {
    products,
    productsByCategory,
    categories,
    departments,
    wishlist,
    toggleWishlist,
    addToCart,
    compareProductIds,
    compareProducts,
    toggleCompareProduct,
    clearCompareProducts,
    filterPresets,
    saveFilterPreset,
    deleteFilterPreset,
    recordFilterSnapshot,
  } = useApp();

  const query = params.query?.trim() ?? '';
  const baseline = query ? SEARCH_DEFAULT_FILTERS : DEFAULT_PRODUCT_FILTERS;
  const [filters, setFilters] = useState<ProductListFilters>(() => ({
    ...baseline,
    ...params.initialFilters,
  }));
  const [draftFilters, setDraftFilters] = useState<ProductListFilters>(filters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [compareSheetOpen, setCompareSheetOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const listRef = useRef<FlatList<CatalogProduct>>(null);
  useScrollToTop(listRef);

  const department = params.departmentId
    ? departments.find((item) => item.id === params.departmentId)
    : undefined;
  // In a department, one of its collections can be picked from the tabs above the filters.
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const categoryName = params.categoryId
    ? categories.find((item) => item.id === params.categoryId)?.name
    : undefined;
  const title =
    params.title ?? department?.name ?? categoryName ?? (query ? `„${query}”` : 'Produse');

  // What the filters narrow down: the category, or the ranked search matches.
  const search = useMemo(() => (query ? searchProducts(products, query) : null), [products, query]);
  const departmentScope = useMemo(
    () => (department ? departmentProducts(department, products) : null),
    [department, products],
  );
  const scope = useMemo(() => {
    if (search) return search.products;
    if (departmentScope)
      return collectionId ? (productsByCategory.get(collectionId) ?? []) : departmentScope;
    return params.categoryId ? (productsByCategory.get(params.categoryId) ?? []) : products;
  }, [collectionId, departmentScope, params.categoryId, products, productsByCategory, search]);

  const results = useMemo(
    () => computeResults(scope, filters, wishlist),
    [filters, scope, wishlist],
  );
  const draftCount = useMemo(
    () => (filterSheetOpen ? computeResults(scope, draftFilters, wishlist).length : 0),
    [draftFilters, filterSheetOpen, scope, wishlist],
  );

  const brandOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of scope) {
      if (product.brand) counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ro'))
      .slice(0, 30);
  }, [scope]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () => (
        <IconButton
          icon="search"
          accessibilityLabel="Caută"
          onPress={() => openSearch(query || undefined)}
          size={38}
        />
      ),
    });
  }, [navigation, openSearch, query, title]);

  const cardWidth = (Math.min(width, 900) - spacing.md * 2 - GRID_GAP) / COLUMNS;
  const compareSet = useMemo(() => new Set(compareProductIds), [compareProductIds]);
  const compareFull = compareProductIds.length >= COMPARE_PRODUCTS_LIMIT;
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
        compareMode={compareMode}
        compareSelected={compareSet.has(item.id)}
        compareDisabled={compareFull}
        onToggleCompare={toggleCompareProduct}
      />
    ),
    [
      addProductToCart,
      cardWidth,
      compareFull,
      compareMode,
      compareSet,
      openProduct,
      toggleCompareProduct,
      toggleWishlist,
      wishlist,
    ],
  );

  const applyFilters = (next: ProductListFilters) => {
    setFilters(next);
    if (query) recordFilterSnapshot(query, next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const updateFilter = <K extends keyof ProductListFilters>(key: K, value: ProductListFilters[K]) =>
    applyFilters({ ...filters, [key]: value });

  const openFilterSheet = () => {
    setDraftFilters(filters);
    setFilterSheetOpen(true);
  };

  const resetFilters = () => applyFilters({ ...baseline, sortOption: filters.sortOption });
  const activeFilterCount = countActiveFilters(filters, baseline);
  const resultLabel = productCount(results.length);

  const pickCollection = (id: string | null) => {
    setCollectionId(id);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const toolbar = (
    <View style={styles.toolbar}>
      {department && department.children.length > 0 ? (
        <CollectionTabs
          items={[
            { id: null, label: 'Toate' },
            ...department.children.map((child) => ({ id: child.id, label: child.name })),
          ]}
          selected={collectionId}
          onSelect={pickCollection}
        />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Filtre"
          icon="options-outline"
          count={activeFilterCount}
          selected={activeFilterCount > 0}
          onPress={openFilterSheet}
        />
        <Chip
          label={SORT_LABELS[filters.sortOption]}
          icon="swap-vertical"
          dropdown
          selected={filters.sortOption !== 'relevanta'}
          onPress={() => setSortSheetOpen(true)}
        />
        <Chip
          label="În stoc"
          selected={filters.onlyInStock}
          onPress={() => updateFilter('onlyInStock', !filters.onlyInStock)}
        />
        <Chip
          label="Reduceri"
          selected={filters.onlyDiscount}
          onPress={() => updateFilter('onlyDiscount', !filters.onlyDiscount)}
        />
        <Chip
          label="Compară"
          icon="git-compare-outline"
          selected={compareMode}
          onPress={() => setCompareMode((current) => !current)}
        />
      </ScrollView>
      <View style={styles.summary}>
        <AppText variant="footnote" tone="secondary">
          {resultLabel}
        </AppText>
        {search && search.mode !== 'name' && search.mode !== 'none' ? (
          <AppText variant="footnote" tone="secondary" numberOfLines={1} style={styles.summaryNote}>
            Rezultate apropiate pentru „{query}”
          </AppText>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (compareMode ? 110 : spacing.xxl) + insets.bottom },
        ]}
        ListHeaderComponent={toolbar}
        stickyHeaderIndices={[0]}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <EmptyState
            icon={query ? 'search-outline' : 'cube-outline'}
            title={
              query && scope.length === 0
                ? `Niciun rezultat pentru „${query}”`
                : 'Niciun produs găsit'
            }
            message={
              activeFilterCount > 0
                ? 'Filtrele active ascund toate produsele. Scoate câteva ca să vezi mai multe.'
                : query
                  ? 'Verifică ortografia sau încearcă un termen mai general.'
                  : 'Categoria nu are produse momentan.'
            }
            actionLabel={
              activeFilterCount > 0 ? 'Resetează filtrele' : query ? 'Caută altceva' : undefined
            }
            onAction={activeFilterCount > 0 ? resetFilters : () => openSearch(query)}
          />
        }
      />

      {compareMode ? (
        <Animated.View
          entering={barEnter}
          exiting={barExit}
          style={[styles.compareBar, { paddingBottom: insets.bottom + spacing.sm }]}
        >
          <View style={styles.compareTexts}>
            <AppText variant="headline">
              {compareProductIds.length} din {COMPARE_PRODUCTS_LIMIT} produse
            </AppText>
            <AppText variant="footnote" tone="secondary">
              Atinge + pe produsele pe care vrei să le compari.
            </AppText>
          </View>
          <Button
            title="Compară"
            size="md"
            disabled={compareProductIds.length < 2}
            onPress={() => setCompareSheetOpen(true)}
          />
        </Animated.View>
      ) : null}

      <Sheet visible={sortSheetOpen} onClose={() => setSortSheetOpen(false)} title="Sortează după">
        <View style={styles.options}>
          {SORT_OPTIONS.map((option) => {
            const selected = filters.sortOption === option;
            return (
              <ListItem
                key={option}
                title={SORT_LABELS[option]}
                selected={selected}
                onPress={() => {
                  updateFilter('sortOption', option);
                  setSortSheetOpen(false);
                }}
                accessory={
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? colors.brand : colors.lineStrong}
                  />
                }
              />
            );
          })}
        </View>
      </Sheet>

      <Sheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filtre"
        footer={
          <>
            <Button
              title="Resetează"
              variant="secondary"
              style={styles.footerButton}
              onPress={() => setDraftFilters({ ...baseline, sortOption: draftFilters.sortOption })}
            />
            <Button
              title={`Arată ${productCount(draftCount)}`}
              style={styles.footerButtonWide}
              onPress={() => {
                applyFilters(draftFilters);
                setFilterSheetOpen(false);
              }}
            />
          </>
        }
      >
        <View style={styles.sheetGroup}>
          <AppText variant="headline">Preț</AppText>
          <View style={styles.wrap}>
            {PRICE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={PRICE_LABELS[option]}
                selected={draftFilters.priceFilter === option}
                onPress={() => setDraftFilters((current) => ({ ...current, priceFilter: option }))}
              />
            ))}
          </View>
        </View>

        <View style={styles.sheetGroup}>
          <AppText variant="headline">Afișează</AppText>
          <View style={styles.toggles}>
            <ToggleRow
              label="Doar produse în stoc"
              value={draftFilters.onlyInStock}
              onChange={(value) =>
                setDraftFilters((current) => ({ ...current, onlyInStock: value }))
              }
            />
            <ToggleRow
              label="Doar produse la reducere"
              value={draftFilters.onlyDiscount}
              onChange={(value) =>
                setDraftFilters((current) => ({ ...current, onlyDiscount: value }))
              }
            />
            <ToggleRow
              label="Doar favoritele mele"
              value={draftFilters.onlyFavorites}
              onChange={(value) =>
                setDraftFilters((current) => ({ ...current, onlyFavorites: value }))
              }
            />
          </View>
        </View>

        {brandOptions.length > 1 ? (
          <View style={styles.sheetGroup}>
            <AppText variant="headline">Brand</AppText>
            <View style={styles.wrap}>
              <Chip
                label="Toate"
                selected={draftFilters.brandFilter === 'toate'}
                onPress={() => setDraftFilters((current) => ({ ...current, brandFilter: 'toate' }))}
              />
              {brandOptions.map(([brand, count]) => (
                <Chip
                  key={brand}
                  label={`${brand} (${count})`}
                  selected={draftFilters.brandFilter === brand}
                  onPress={() => setDraftFilters((current) => ({ ...current, brandFilter: brand }))}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sheetGroup}>
          <AppText variant="headline">Filtre salvate</AppText>
          {filterPresets.length > 0 ? (
            <View style={styles.wrap}>
              {filterPresets.map((preset) => (
                <View key={preset.id} style={styles.presetRow}>
                  <Chip
                    icon="bookmark-outline"
                    label={preset.name}
                    onPress={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        brandFilter: preset.brandFilter,
                        priceFilter: preset.priceFilter,
                        onlyDiscount: preset.onlyDiscount,
                        onlyInStock: preset.onlyInStock,
                        sortOption: preset.sortOption,
                      }))
                    }
                  />
                  <IconButton
                    icon="close"
                    size={30}
                    accessibilityLabel={`Șterge ${preset.name}`}
                    onPress={() => deleteFilterPreset(preset.id)}
                    color={colors.textTertiary}
                  />
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="subhead" tone="secondary">
              Salvează combinațiile folosite des ca să le aplici dintr-o atingere.
            </AppText>
          )}
          <Button
            title="Salvează filtrele alese"
            variant="outline"
            size="sm"
            icon="bookmark-outline"
            onPress={() => saveFilterPreset(draftFilters)}
            style={styles.savePreset}
          />
        </View>
      </Sheet>

      <Sheet
        visible={compareSheetOpen}
        onClose={() => setCompareSheetOpen(false)}
        title="Comparație"
      >
        {compareProducts.length === 0 ? (
          <EmptyState
            icon="git-compare-outline"
            title="Niciun produs ales"
            message="Activează Compară și alege produse din listă."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compareColumns}
          >
            {compareProducts.map((product) => (
              <View key={product.id} style={styles.compareColumn}>
                <ProductRow product={product} thumbSize={56} hidePrice />
                <CompareRow label="Preț" value={formatPrice(product.priceRon)} />
                <CompareRow label="Brand" value={product.brand || 'Dacus'} />
                <CompareRow label="Cod produs" value={product.sku || '-'} />
                <StockLine label={product.stockLabel} inStock={isProductInStock(product)} />
                <View style={styles.compareActions}>
                  <Button
                    title="Vezi produsul"
                    size="sm"
                    variant="secondary"
                    style={styles.flex}
                    onPress={() => {
                      setCompareSheetOpen(false);
                      openProduct(product.id);
                    }}
                  />
                  <IconButton
                    icon="close"
                    size={36}
                    variant="soft"
                    accessibilityLabel="Scoate din comparație"
                    onPress={() => toggleCompareProduct(product.id)}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
        {compareProducts.length > 0 ? (
          <Button title="Golește comparația" variant="ghost" onPress={clearCompareProducts} />
        ) : null}
      </Sheet>
    </View>
  );
}

type CollectionTab = { id: string | null; label: string };

/** The department's collections as text tabs (an underline marks the current one), separate from the filter chips. */
function CollectionTabs({
  items,
  selected,
  onSelect,
}: {
  items: CollectionTab[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
    >
      {items.map((item) => {
        const active = item.id === selected;
        return (
          <Touchable
            key={item.id ?? 'all'}
            onPress={() => onSelect(item.id)}
            pressedScale={0.95}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <AppText
              variant={active ? 'headline' : 'callout'}
              tone={active ? 'primary' : 'secondary'}
            >
              {item.label}
            </AppText>
            <View style={[styles.tabLine, active && styles.tabLineActive]} />
          </Touchable>
        );
      })}
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: colors.lineStrong }}
        thumbColor={colors.surface}
        accessibilityLabel={label}
      />
    </View>
  );
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.compareRow}>
      <AppText variant="caption" tone="tertiary">
        {label}
      </AppText>
      <AppText variant="subheadMedium" numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },
  row: { gap: GRID_GAP },
  toolbar: {
    backgroundColor: colors.canvas,
    marginHorizontal: -spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chips: { paddingHorizontal: spacing.md, gap: spacing.xs },
  tabs: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    marginBottom: spacing.xs,
  },
  tab: { paddingTop: spacing.xxs, gap: 6 },
  tabLine: { height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  tabLineActive: { backgroundColor: colors.brand },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  summaryNote: { flex: 1 },
  compareBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.bar,
  },
  compareTexts: { flex: 1, gap: 2 },
  options: { marginHorizontal: -spacing.lg },
  sheetGroup: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  toggles: { gap: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  presetRow: { flexDirection: 'row', alignItems: 'center' },
  savePreset: { alignSelf: 'flex-start' },
  footerButton: { flex: 1 },
  footerButtonWide: { flex: 2 },
  flex: { flex: 1 },
  compareColumns: { gap: spacing.sm, paddingBottom: spacing.xs },
  compareColumn: {
    width: 220,
    backgroundColor: colors.grouped,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  compareRow: { gap: 1 },
  compareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AnimatedEntrance, CollapsibleFilterPanel, SemanticPill } from '../components/UXComponents';
import { colors } from '../theme/tokens';
import type { PriceFilterOption, SortOption } from '../utils/catalogFilters';
import type { ScreenStyles } from './screenTypes';

type ProductsScreenProps = {
  styles: ScreenStyles;
  selectedCategoryName: string;
  searchQuery: string;
  productsTotalForView: number;
  filteredProductsCount: number;
  sortLabel: string;
  sortOption: SortOption;
  onlyFavorites: boolean;
  filterCount: number;
  brandFilter: string;
  availableBrands: string[];
  priceFilter: PriceFilterOption;
  onlyDiscount: boolean;
  onlyInStock: boolean;
  brandFacetCounts: Record<string, number>;
  categoryFacetOptions: Array<{ id: string; label: string; count: number; active: boolean }>;
  availabilityFacetCounts: { inStock: number; outOfStock: number };
  facetConfidenceHints: Array<{ label: string; tone: 'success' | 'warning' | 'info' | 'danger' }>;
  onCycleSort: () => void;
  onToggleFavorites: () => void;
  onOpenCategories: () => void;
  onResetFilters: () => void;
  onSetBrandFilter: (value: string) => void;
  onSetPriceFilter: (value: PriceFilterOption) => void;
  onToggleOnlyDiscount: () => void;
  onSetOnlyInStock: (value: boolean) => void;
  onToggleOnlyInStock: () => void;
  onSetCategoryFacet: (value: string) => void;
  onSetSortOption: (value: SortOption) => void;
  onClearSearch: () => void;
  productListNode: React.ReactNode;
};

export const ProductsScreen = ({
  styles,
  selectedCategoryName,
  searchQuery,
  productsTotalForView,
  filteredProductsCount,
  sortLabel,
  sortOption,
  onlyFavorites,
  filterCount,
  brandFilter,
  availableBrands,
  priceFilter,
  onlyDiscount,
  onlyInStock,
  brandFacetCounts,
  categoryFacetOptions,
  availabilityFacetCounts,
  facetConfidenceHints,
  onCycleSort,
  onToggleFavorites,
  onOpenCategories,
  onResetFilters,
  onSetBrandFilter,
  onSetPriceFilter,
  onToggleOnlyDiscount,
  onSetOnlyInStock,
  onToggleOnlyInStock,
  onSetCategoryFacet,
  onSetSortOption,
  onClearSearch,
  productListNode,
}: ProductsScreenProps) => (
  <View style={styles.stackLarge}>
    <AnimatedEntrance>
      <View style={styles.catalogHeroCard}>
        <Text style={styles.catalogHeroEyebrow}>CATALOG DACUS</Text>
        <Text style={styles.catalogHeroTitle}>{selectedCategoryName}</Text>
        <Text style={styles.catalogHeroMeta}>
          {searchQuery.trim()
            ? `${productsTotalForView || filteredProductsCount} rezultate pentru „${searchQuery.trim()}”`
            : `${filteredProductsCount} din ${productsTotalForView || filteredProductsCount} produse în colecție`}
        </Text>

        <View style={styles.productsCountPill}>
          <Text style={styles.productsCountPillText}>{filteredProductsCount} produse vizibile</Text>
        </View>

        {facetConfidenceHints.length > 0 ? (
          <View style={styles.collectionScopeRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {facetConfidenceHints.map((hint) => (
                <SemanticPill key={hint.label} label={hint.label} tone={hint.tone} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.catalogHeroActionsRow}>
          <TouchableOpacity style={styles.catalogActionPill} onPress={onCycleSort}>
            <Ionicons name="swap-vertical-outline" size={16} color={colors.brandRed} />
            <Text style={styles.catalogActionPillText}>Sortare: {sortLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.catalogActionPill, onlyFavorites && styles.catalogActionPillActive]}
            onPress={onToggleFavorites}
          >
            <Ionicons
              name={onlyFavorites ? 'heart' : 'heart-outline'}
              size={16}
              color={onlyFavorites ? '#FFFFFF' : colors.brandRed}
            />
            <Text
              style={[
                styles.catalogActionPillText,
                onlyFavorites && styles.catalogActionPillTextActive,
              ]}
            >
              {onlyFavorites ? 'Doar favorite' : 'Include favorite'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.catalogActionPill} onPress={onResetFilters}>
            <Ionicons name="refresh-outline" size={16} color={colors.brandRed} />
            <Text style={styles.catalogActionPillText}>Resetează filtre</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedEntrance>

    <View style={styles.collectionScopeRow}>
      <Text style={styles.collectionScopeText}>Colecție selectată: {selectedCategoryName}</Text>
      <TouchableOpacity style={styles.collectionScopeButton} onPress={onOpenCategories}>
        <Text style={styles.collectionScopeButtonText}>Schimbă colecția</Text>
      </TouchableOpacity>
    </View>

    <AnimatedEntrance delay={80}>
      <View style={styles.filterPanel}>
        <CollapsibleFilterPanel filterCount={filterCount} title="Filtrare avansată">
          <Text style={styles.filterIntroText}>
            Alege rapid brand, preț și disponibilitate pentru a ajunge mai repede la produsul dorit.
          </Text>
          <View style={styles.filterHeadRow}>
            <Text style={styles.filterTitle}>Filtre active</Text>
            <TouchableOpacity style={styles.resetFilterButton} onPress={onResetFilters}>
              <Text style={styles.resetFilterText}>Resetează</Text>
            </TouchableOpacity>
          </View>

          {categoryFacetOptions.length > 0 ? (
            <>
              <Text style={styles.filterLabel}>Categorii populare</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipRow}
              >
                {categoryFacetOptions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.filterPill, item.active && styles.filterPillActive]}
                    onPress={() => onSetCategoryFacet(item.id)}
                  >
                    <Text
                      style={[styles.filterPillText, item.active && styles.filterPillTextActive]}
                    >
                      {item.label} ({item.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.filterLabel}>Brand</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          >
            <TouchableOpacity
              style={[styles.filterPill, brandFilter === 'toate' && styles.filterPillActive]}
              onPress={() => onSetBrandFilter('toate')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  brandFilter === 'toate' && styles.filterPillTextActive,
                ]}
              >
                Toate brandurile
              </Text>
            </TouchableOpacity>
            {availableBrands.map((brand) => (
              <TouchableOpacity
                key={brand}
                style={[styles.filterPill, brandFilter === brand && styles.filterPillActive]}
                onPress={() => onSetBrandFilter(brand)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    brandFilter === brand && styles.filterPillTextActive,
                  ]}
                >
                  {brand}
                  {brandFacetCounts[brand] ? ` (${brandFacetCounts[brand]})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Preț</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          >
            {[
              { key: 'toate', label: 'Toate prețurile' },
              { key: 'sub200', label: 'Sub 200 RON' },
              { key: 'intre200si500', label: '200-500 RON' },
              { key: 'intre500si1000', label: '500-1000 RON' },
              { key: 'peste1000', label: 'Peste 1000 RON' },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterPill, priceFilter === item.key && styles.filterPillActive]}
                onPress={() => onSetPriceFilter(item.key as PriceFilterOption)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    priceFilter === item.key && styles.filterPillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleChip, onlyDiscount && styles.toggleChipActive]}
              onPress={onToggleOnlyDiscount}
            >
              <Text style={[styles.toggleChipText, onlyDiscount && styles.toggleChipTextActive]}>
                Doar promoții
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleChip, onlyInStock && styles.toggleChipActive]}
              onPress={() => onSetOnlyInStock(true)}
            >
              <Text style={[styles.toggleChipText, onlyInStock && styles.toggleChipTextActive]}>
                În stoc ({availabilityFacetCounts.inStock})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleChip, !onlyInStock && styles.toggleChipActive]}
              onPress={() => onSetOnlyInStock(false)}
            >
              <Text style={[styles.toggleChipText, !onlyInStock && styles.toggleChipTextActive]}>
                Toate ({availabilityFacetCounts.inStock + availabilityFacetCounts.outOfStock})
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterLabel}>Sortare</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          >
            {[
              { key: 'relevanta', label: 'Relevanță' },
              { key: 'pretCrescator', label: 'Preț crescător' },
              { key: 'pretDescrescator', label: 'Preț descrescător' },
              { key: 'numeAZ', label: 'Nume A-Z' },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterPill, sortOption === item.key && styles.filterPillActive]}
                onPress={() => onSetSortOption(item.key as SortOption)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    sortOption === item.key && styles.filterPillTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterSummary}>{filterCount} filtre active</Text>
        </CollapsibleFilterPanel>
      </View>
    </AnimatedEntrance>

    {filterCount > 0 || searchQuery.trim().length > 0 ? (
      <View style={styles.activeFilterWrap}>
        {searchQuery.trim().length > 0 ? (
          <TouchableOpacity style={styles.activeFilterChip} onPress={onClearSearch}>
            <Text style={styles.activeFilterChipText}>Căutare: {searchQuery.trim()} ✕</Text>
          </TouchableOpacity>
        ) : null}
        {brandFilter !== 'toate' ? (
          <TouchableOpacity
            style={styles.activeFilterChip}
            onPress={() => onSetBrandFilter('toate')}
          >
            <Text style={styles.activeFilterChipText}>Brand: {brandFilter} ✕</Text>
          </TouchableOpacity>
        ) : null}
        {priceFilter !== 'toate' ? (
          <TouchableOpacity
            style={styles.activeFilterChip}
            onPress={() => onSetPriceFilter('toate')}
          >
            <Text style={styles.activeFilterChipText}>Preț: {priceFilter} ✕</Text>
          </TouchableOpacity>
        ) : null}
        {onlyDiscount ? (
          <TouchableOpacity style={styles.activeFilterChip} onPress={onToggleOnlyDiscount}>
            <Text style={styles.activeFilterChipText}>Promoții ✕</Text>
          </TouchableOpacity>
        ) : null}
        {onlyInStock ? (
          <TouchableOpacity style={styles.activeFilterChip} onPress={onToggleOnlyInStock}>
            <Text style={styles.activeFilterChipText}>În stoc ✕</Text>
          </TouchableOpacity>
        ) : null}
        {onlyFavorites ? (
          <TouchableOpacity style={styles.activeFilterChip} onPress={onToggleFavorites}>
            <Text style={styles.activeFilterChipText}>Favorite ✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : null}

    {productListNode}
  </View>
);

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { fixRomanianMojibake } from '../utils/string';
import { useDebouncedValue } from '../utils/useDebounce';
import { formatPrice } from '../utils/catalogFilters';

type SearchProductHit = {
  id: string;
  name: string;
  brand: string;
  priceRon: number;
  stockLabel?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
};

export type SearchHistoryItem = {
  id: string;
  query: string;
  timestamp: number;
  resultCount?: number;
};

export type SearchSuggestion = {
  id: string;
  text: string;
  type: 'recent' | 'suggestion' | 'trending';
};

export type RecentFilterItem = {
  id: string;
  label: string;
};

type AdvancedSearchProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (query: string) => void;
  onSelectSuggestion: (suggestion: string) => void;
  suggestions?: string[];
  recentSearches?: string[];
  savedSearches?: string[];
  recentFilters?: RecentFilterItem[];
  trendingSearches?: string[];
  productResults?: SearchProductHit[];
  placeholder?: string;
  loading?: boolean;
  autoFocus?: boolean;
  onSaveSearch?: (query: string) => void;
  onSelectRecentFilter?: (filterId: string) => void;
  onSelectProduct?: (productId: string) => void;
};

export function AdvancedSearch({
  value,
  onChangeText,
  onSubmit,
  onSelectSuggestion,
  suggestions = [],
  recentSearches = [],
  savedSearches = [],
  recentFilters = [],
  trendingSearches = [],
  productResults = [],
  placeholder = 'Caută produse, branduri, cod, SKU',
  loading = false,
  autoFocus = false,
  onSaveSearch,
  onSelectRecentFilter,
  onSelectProduct,
}: AdvancedSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebouncedValue(localValue, 300);

  const showSuggestions =
    isFocused &&
    (localValue.length >= 2 ||
      recentSearches.length > 0 ||
      savedSearches.length > 0 ||
      recentFilters.length > 0 ||
      trendingSearches.length > 0 ||
      productResults.length > 0);

  const showProductResults = isFocused && productResults.length > 0;

  // Sync external value changes
  useEffect(() => {
    if (!isFocused && value !== localValue) {
      setLocalValue(value);
    }
  }, [isFocused, localValue, value]);

  // Call onChangeText with debounced value
  useEffect(() => {
    if (debouncedValue !== value) {
      onChangeText(debouncedValue);
    }
  }, [debouncedValue, onChangeText, value]);

  const handleClear = () => {
    const emptyValue = '';
    setLocalValue(emptyValue);
    onChangeText(emptyValue);
    setIsFocused(false);
  };

  const handleDismiss = () => {
    setIsFocused(false);
  };

  const handleSubmit = () => {
    if (localValue.trim()) {
      onSubmit(localValue.trim());
    }
  };

  const handleSaveSearch = () => {
    const query = localValue.trim();
    if (!query || !onSaveSearch) return;
    onSaveSearch(query);
  };

  const handleSelectRecent = (query: string) => {
    setLocalValue(query);
    onSelectSuggestion(query);
  };

  const renderRecentItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      key={`recent-${index}`}
      style={styles.suggestionItem}
      onPress={() => handleSelectRecent(item)}
    >
      <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderTrendingItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      key={`trending-${index}`}
      style={styles.suggestionItem}
      onPress={() => handleSelectRecent(item)}
    >
      <Ionicons name="trending-up" size={18} color={colors.brandAmber} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderSuggestionItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      key={`suggestion-${index}`}
      style={styles.suggestionItem}
      onPress={() => handleSelectRecent(item)}
    >
      <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderSavedSearchItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      key={`saved-${index}`}
      style={styles.suggestionItem}
      onPress={() => handleSelectRecent(item)}
    >
      <Ionicons name="bookmark-outline" size={18} color={colors.brandRed} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderRecentFilterItem = ({ item }: { item: RecentFilterItem }) => (
    <TouchableOpacity
      key={item.id}
      style={styles.filterPill}
      onPress={() => onSelectRecentFilter?.(item.id)}
    >
      <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.filterPillText}>{item.label}</Text>
    </TouchableOpacity>
  );

  const renderProductResult = ({ item }: { item: SearchProductHit }) => {
    const imageUrl = item.thumbnailUrl || item.imageUrl;
    const hasImage = imageUrl && /^https?:\/\//.test(imageUrl);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.productResultItem}
        onPress={() => {
          setIsFocused(false);
          onSelectProduct?.(item.id);
        }}
      >
        <View style={styles.productResultImageWrap}>
          {hasImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.productResultImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.productResultImageFallback}>
              <Text style={styles.productResultImageFallbackText}>?</Text>
            </View>
          )}
        </View>
        <View style={styles.productResultContent}>
          <Text style={styles.productResultBrand} numberOfLines={1}>
            {fixRomanianMojibake(item.brand)}
          </Text>
          <Text style={styles.productResultName} numberOfLines={2}>
            {fixRomanianMojibake(item.name)}
          </Text>
          <View style={styles.productResultFooter}>
            <Text style={styles.productResultStock} numberOfLines={1}>
              {fixRomanianMojibake(item.stockLabel || '') || 'Verifică stoc'}
            </Text>
            <Text style={styles.productResultPrice}>{formatPrice(item.priceRon)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {isFocused && showSuggestions && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />
      )}
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        <Ionicons
          name="search-outline"
          size={20}
          color={isFocused ? colors.brandRed : colors.textSecondary}
        />
        <TextInput
          style={styles.input}
          value={localValue}
          onChangeText={setLocalValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Keep dropdown visible after keyboard closes
          }}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color={colors.brandRed} />
          </View>
        )}
        {localValue.length > 0 && !loading && (
          <View style={styles.searchActions}>
            {onSaveSearch ? (
              <TouchableOpacity onPress={handleSaveSearch} style={styles.clearButton}>
                <Ionicons name="bookmark-outline" size={18} color={colors.brandRed} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showSuggestions && (
        <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled>
          {localValue.trim().length >= 2 && loading && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Se caută...</Text>
            </View>
          )}

          {showProductResults ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Produse găsite ({productResults.length})</Text>
              {productResults.slice(0, 8).map((item) => renderProductResult({ item }))}
            </View>
          ) : localValue.trim().length >= 2 && !loading ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nu au fost găsite produse</Text>
              <Text style={styles.bodyMuted}>Încearcă alt termen de căutare</Text>
            </View>
          ) : null}

          {localValue.length === 0 && recentSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Căutări recente</Text>
              <FlatList
                data={recentSearches.slice(0, 5)}
                renderItem={renderRecentItem}
                keyExtractor={(item, index) => `recent-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {localValue.length === 0 && savedSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Căutări salvate</Text>
              <FlatList
                data={savedSearches.slice(0, 6)}
                renderItem={renderSavedSearchItem}
                keyExtractor={(item, index) => `saved-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {localValue.length === 0 && recentFilters.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Filtre folosite recent</Text>
              <FlatList
                data={recentFilters.slice(0, 6)}
                renderItem={renderRecentFilterItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.filterRow}
              />
            </View>
          )}

          {localValue.length >= 2 && suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sugestii</Text>
              <FlatList
                data={suggestions.slice(0, 8)}
                renderItem={renderSuggestionItem}
                keyExtractor={(item, index) => `suggestion-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {localValue.length === 0 && trendingSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending acum</Text>
              <FlatList
                data={trendingSearches.slice(0, 5)}
                renderItem={renderTrendingItem}
                keyExtractor={(item, index) => `trending-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Offline Banner Component
 */
type OfflineBannerProps = {
  visible: boolean;
  onRetry?: () => void;
};

export function OfflineBanner({ visible, onRetry }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="wifi-off-outline" size={16} color="#FFFFFF" />
      <Text style={styles.offlineText}>Ești offline. Unele funcționalități pot fi limitate.</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Reîncearcă</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 99,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F5F7',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchContainerFocused: {
    borderColor: colors.brandRed,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  loadingIndicator: {
    marginLeft: spacing.xs,
  },
  clearButton: {
    marginLeft: spacing.xs,
    padding: spacing.xxs,
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: spacing.sm,
    maxHeight: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 101,
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
  },
  productResultItem: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandRed,
    gap: spacing.sm,
    alignItems: 'center',
  },
  productResultImageWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productResultImage: {
    width: '100%',
    height: '100%',
  },
  productResultImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  productResultImageFallbackText: {
    color: colors.textSecondary,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  productResultContent: {
    flex: 1,
    gap: spacing.xs,
  },
  productResultBrand: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  productResultName: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 20,
  },
  productResultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  productResultStock: {
    color: colors.textSecondary,
    fontSize: typography.micro,
  },
  productResultPrice: {
    color: colors.brandRed,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  filterRow: {
    gap: spacing.xs,
  },
  filterPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  filterPillText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bodyMuted: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandAmber,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  offlineText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '700',
  },
});

export default AdvancedSearch;

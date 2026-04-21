import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { useDebouncedValue } from '../utils/useDebounce';

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
  placeholder?: string;
  loading?: boolean;
  autoFocus?: boolean;
  onSaveSearch?: (query: string) => void;
  onSelectRecentFilter?: (filterId: string) => void;
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
  placeholder = 'Caută produse, branduri, cod, SKU',
  loading = false,
  autoFocus = false,
  onSaveSearch,
  onSelectRecentFilter,
}: AdvancedSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebouncedValue(localValue, 300);

  const intentSuggestions = useMemo(() => {
    const query = localValue.trim();
    if (query.length < 2) return [] as string[];

    const next = new Set<string>();
    if (/\d{4,}/.test(query)) {
      next.add(`Cod/SKU: ${query}`);
    }
    next.add(`${query} în stoc`);
    next.add(`${query} promoții`);
    next.add(`${query} livrare rapidă`);
    return Array.from(next).slice(0, 4);
  }, [localValue]);

  const showSuggestions =
    isFocused &&
    (localValue.length >= 2 ||
      recentSearches.length > 0 ||
      savedSearches.length > 0 ||
      recentFilters.length > 0 ||
      trendingSearches.length > 0);

  // Sync external value changes
  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value);
    }
  }, [localValue, value]);

  // Call onChangeText with debounced value
  useEffect(() => {
    if (debouncedValue !== value) {
      onChangeText(debouncedValue);
    }
  }, [debouncedValue, onChangeText, value]);

  const handleClear = () => {
    setLocalValue('');
    onChangeText('');
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
      <MaterialCommunityIcons name="history" size={18} color={colors.textSecondary} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderTrendingItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      key={`trending-${index}`}
      style={styles.suggestionItem}
      onPress={() => handleSelectRecent(item)}
    >
      <MaterialCommunityIcons name="trending-up" size={18} color={colors.brandAmber} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderSuggestionItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      key={`suggestion-${index}`}
      style={styles.suggestionItem}
      onPress={() => handleSelectRecent(item)}
    >
      <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderIntentItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity key={`intent-${index}`} style={styles.suggestionItem} onPress={() => handleSelectRecent(item)}>
      <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.info} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderSavedSearchItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity key={`saved-${index}`} style={styles.suggestionItem} onPress={() => handleSelectRecent(item)}>
      <MaterialCommunityIcons name="bookmark-outline" size={18} color={colors.brandRed} />
      <Text style={styles.suggestionText}>{item}</Text>
    </TouchableOpacity>
  );

  const renderRecentFilterItem = ({ item }: { item: RecentFilterItem }) => (
    <TouchableOpacity key={item.id} style={styles.filterPill} onPress={() => onSelectRecentFilter?.(item.id)}>
      <MaterialCommunityIcons name="tune-variant" size={14} color={colors.textSecondary} />
      <Text style={styles.filterPillText}>{item.label}</Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="magnify" size={48} color={colors.border} />
      <Text style={styles.emptyText}>
        {localValue.length >= 2
          ? 'Nu am găsit sugestii pentru această căutare'
          : 'Începe să tastezi pentru a vedea sugestii'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={isFocused ? colors.brandRed : colors.textSecondary}
        />
        <TextInput
          style={styles.input}
          value={localValue}
          onChangeText={setLocalValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onSubmitEditing={handleSubmit}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && (
          <Animated.View style={styles.loadingIndicator}>
            <MaterialCommunityIcons name="loading" size={18} color={colors.brandRed} />
          </Animated.View>
        )}
        {localValue.length > 0 && !loading && (
          <View style={styles.searchActions}>
            {onSaveSearch ? (
              <TouchableOpacity onPress={handleSaveSearch} style={styles.clearButton}>
                <MaterialCommunityIcons name="bookmark-plus-outline" size={18} color={colors.brandRed} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
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

          {/* Saved searches */}
          {savedSearches.length > 0 && (
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

          {/* Recent filters */}
          {recentFilters.length > 0 && (
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

          {/* Intent suggestions */}
          {intentSuggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sugestii inteligente</Text>
              <FlatList
                data={intentSuggestions}
                renderItem={renderIntentItem}
                keyExtractor={(item, index) => `intent-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
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

          {/* Trending */}
          {trendingSearches.length > 0 && localValue.length === 0 && (
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

          {/* Empty state */}
          {localValue.length >= 2 && suggestions.length === 0 && recentSearches.length === 0 && (
            renderEmptyState()
          )}
        </View>
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
      <MaterialCommunityIcons name="wifi-off" size={16} color="#FFFFFF" />
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
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppProvider';
import { colors, continuous, fonts, hitSlop, radii, spacing } from '../theme/tokens';
import { AppText, Chip, enterUp, fadeIn, ProductRow, SearchField, Touchable } from '../ui';
import { foldForSearch, MIN_QUERY_LENGTH, searchProducts, splitHighlights } from '../utils/search';

const PREVIEW_LIMIT = 6;
const CATEGORY_LIMIT = 3;

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Search'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Search'>>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const {
    products,
    categories,
    recentSearches,
    savedSearches,
    recentFilterSnapshots,
    trendingSearches,
    recordSearch,
    clearRecentSearches,
    toggleSavedSearch,
  } = useApp();
  const [query, setQuery] = useState(route.params?.initialQuery ?? '');

  // Focus once the screen has finished appearing: focusing during the transition can leave the keyboard
  // closed on Android. The timer covers platforms that don't emit transitionEnd.
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data?.closing) focus();
    });
    const fallback = setTimeout(focus, 400);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);

  // Typing stays responsive: results catch up with the latest text without blocking the input.
  const deferredQuery = useDeferredValue(query);
  const trimmed = deferredQuery.trim();
  const active = foldForSearch(trimmed).length >= MIN_QUERY_LENGTH;

  const result = useMemo(() => (active ? searchProducts(products, trimmed) : null), [active, products, trimmed]);
  const preview = result?.products.slice(0, PREVIEW_LIMIT) ?? [];
  const total = result?.products.length ?? 0;

  const categoryMatches = useMemo(() => {
    if (!active) return [];
    const words = foldForSearch(trimmed).split(' ');
    return categories
      .filter((category) => {
        const name = ` ${foldForSearch(category.name)}`;
        return words.every((word) => name.includes(` ${word}`));
      })
      .slice(0, CATEGORY_LIMIT);
  }, [active, categories, trimmed]);

  const submit = (value: string) => {
    const next = value.trim();
    if (foldForSearch(next).length < MIN_QUERY_LENGTH) return;
    Keyboard.dismiss();
    recordSearch(next);
    navigation.navigate('SearchResults', { query: next });
  };

  const openProductFromSearch = (productId: string) => {
    recordSearch(query.trim());
    navigation.navigate('Product', { productId });
  };

  const highlight = (name: string) =>
    splitHighlights(name, trimmed).map((part, index) =>
      part.match ? (
        <Text key={index} style={styles.match}>
          {part.text}
        </Text>
      ) : (
        part.text
      ),
    );

  const isSaved = savedSearches.includes(query.trim());

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <SearchField
          inputRef={inputRef}
          autoFocus
          value={query}
          onChangeText={setQuery}
          onClear={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          onSubmitEditing={() => submit(query)}
          placeholder="Caută produse, branduri, coduri"
          accessibilityLabel="Caută în catalog"
          style={styles.field}
        />
        <Touchable onPress={() => navigation.goBack()} hitSlop={hitSlop} pressedScale={0.95} accessibilityLabel="Anulează">
          <AppText variant="callout">Anulează</AppText>
        </Touchable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {active && result ? (
          total > 0 ? (
            <Animated.View entering={fadeIn} style={styles.results}>
              <Touchable
                onPress={() => submit(trimmed)}
                pressedScale={0.98}
                style={styles.seeAll}
                accessibilityLabel={`Vezi toate cele ${total} rezultate`}
              >
                <View style={styles.seeAllIcon}>
                  <Ionicons name="search" size={18} color={colors.textInverse} />
                </View>
                <View style={styles.seeAllTexts}>
                  <AppText variant="headline" numberOfLines={1}>
                    „{trimmed}”
                  </AppText>
                  <AppText variant="footnote" tone="secondary">
                    {result.mode === 'name'
                      ? `Vezi toate cele ${total.toLocaleString('ro-RO')} rezultate`
                      : `${total.toLocaleString('ro-RO')} rezultate apropiate`}
                  </AppText>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.textPrimary} />
              </Touchable>

              {categoryMatches.length > 0 ? (
                <View style={styles.group}>
                  <AppText variant="footnote" tone="secondary">
                    Categorii
                  </AppText>
                  <View style={styles.wrap}>
                    {categoryMatches.map((category) => (
                      <Chip
                        key={category.id}
                        icon="grid-outline"
                        label={category.name}
                        onPress={() => navigation.navigate('SearchResults', { categoryId: category.id, title: category.name })}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.group}>
                <AppText variant="footnote" tone="secondary">
                  {result.mode === 'name' ? 'Produse' : 'Nu am găsit exact ce ai scris. Rezultate apropiate:'}
                </AppText>
                <View>
                  {preview.map((product, index) => (
                    <View key={product.id} style={index > 0 ? styles.rowDivider : null}>
                      <ProductRow
                        product={product}
                        onPress={openProductFromSearch}
                        thumbSize={56}
                        highlight={result.mode === 'name' ? highlight : undefined}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <Touchable
                onPress={() => toggleSavedSearch(trimmed)}
                pressedScale={0.97}
                haptic="selection"
                style={styles.saveSearch}
                accessibilityLabel={isSaved ? 'Șterge din căutările salvate' : 'Salvează căutarea'}
              >
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.textPrimary} />
                <AppText variant="subheadMedium">{isSaved ? 'Căutare salvată' : 'Salvează căutarea'}</AppText>
              </Touchable>
            </Animated.View>
          ) : (
            <Animated.View entering={fadeIn} style={styles.noResults}>
              <AppText variant="title3" align="center">
                Niciun rezultat pentru „{trimmed}”
              </AppText>
              <AppText variant="subhead" tone="secondary" align="center">
                Verifică ortografia sau încearcă un termen mai general, de exemplu „bec” în loc de „bec led e27 9w”.
              </AppText>
            </Animated.View>
          )
        ) : (
          <>
            {recentSearches.length > 0 ? (
              <Animated.View entering={enterUp(0)} style={styles.group}>
                <View style={styles.groupHeader}>
                  <AppText variant="title3">Căutări recente</AppText>
                  <Touchable
                    onPress={clearRecentSearches}
                    hitSlop={hitSlop}
                    pressedScale={0.94}
                    accessibilityLabel="Șterge căutările recente"
                  >
                    <AppText variant="footnote" tone="secondary">
                      Șterge
                    </AppText>
                  </Touchable>
                </View>
                {recentSearches.map((item) => (
                  <View key={item} style={styles.recentRow}>
                    <Touchable
                      onPress={() => submit(item)}
                      pressedScale={0.98}
                      style={styles.recentMain}
                      accessibilityLabel={`Caută ${item}`}
                    >
                      <Ionicons name="time-outline" size={19} color={colors.textTertiary} />
                      <AppText variant="body" numberOfLines={1} style={styles.flex}>
                        {item}
                      </AppText>
                    </Touchable>
                    <Touchable
                      onPress={() => {
                        setQuery(item);
                        inputRef.current?.focus();
                      }}
                      hitSlop={hitSlop}
                      pressedScale={0.85}
                      accessibilityLabel={`Editează căutarea ${item}`}
                    >
                      <Ionicons name="arrow-up-outline" size={19} color={colors.textTertiary} style={styles.fillIcon} />
                    </Touchable>
                  </View>
                ))}
              </Animated.View>
            ) : null}

            {savedSearches.length > 0 ? (
              <Animated.View entering={enterUp(1)} style={styles.group}>
                <AppText variant="title3">Căutări salvate</AppText>
                <View style={styles.wrap}>
                  {savedSearches.map((item) => (
                    <Chip key={item} icon="bookmark" label={item} onPress={() => submit(item)} />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {recentFilterSnapshots.length > 0 ? (
              <Animated.View entering={enterUp(2)} style={styles.group}>
                <AppText variant="title3">Filtre folosite recent</AppText>
                <View style={styles.wrap}>
                  {recentFilterSnapshots.map((snapshot) => (
                    <Chip
                      key={snapshot.id}
                      icon="options-outline"
                      label={snapshot.label}
                      onPress={() => navigation.navigate('SearchResults', { query: snapshot.query, initialFilters: snapshot.filters })}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {trendingSearches.length > 0 ? (
              <Animated.View entering={enterUp(3)} style={styles.group}>
                <AppText variant="title3">Populare acum</AppText>
                <View style={styles.wrap}>
                  {trendingSearches.map((item) => (
                    <Chip key={item} icon="trending-up" label={item} onPress={() => submit(item)} />
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  field: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.xl },
  results: { gap: spacing.xl },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.well,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.sm,
  },
  seeAllIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    ...continuous,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllTexts: { flex: 1, gap: 1 },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  match: { fontFamily: fonts.bold, color: colors.textPrimary },
  saveSearch: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingVertical: 4 },
  noResults: { gap: spacing.xs, paddingTop: spacing.xl, paddingHorizontal: spacing.md },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  recentMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  fillIcon: { transform: [{ rotate: '-45deg' }] },
});

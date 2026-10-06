import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type ListRenderItem } from 'react-native';
import Animated from 'react-native-reanimated';

import type { CatalogCategory } from '../data/catalog';
import type { CategoriesStackParamList } from '../navigation/types';
import { useApp } from '../state/AppProvider';
import { colors, continuous, radii, spacing } from '../theme/tokens';
import { AppText, EmptyState, enterUp, hasImageUrl, SearchField, sizedImageUrl, Touchable } from '../ui';
import { foldForSearch } from '../utils/search';

const GAP = spacing.sm;

type Row = { key: string; items: CatalogCategory[]; featured: boolean };

/** One wide tile first, then pairs: a rhythm instead of an even grid of identical boxes. */
const toRows = (categories: CatalogCategory[]): Row[] => {
  const rows: Row[] = [];
  let index = 0;
  if (categories.length > 0) {
    rows.push({ key: `row-${categories[0]?.id}`, items: [categories[0] as CatalogCategory], featured: true });
    index = 1;
  }
  for (; index < categories.length; index += 2) {
    const items = categories.slice(index, index + 2);
    rows.push({ key: `row-${items[0]?.id}`, items, featured: false });
  }
  return rows;
};

export function CategoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CategoriesStackParamList>>();
  const { orderedCategories, countByCategory, trackCategoryView } = useApp();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('');
  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const contentWidth = Math.min(width, 700) - spacing.md * 2;
  const halfWidth = (contentWidth - GAP) / 2;

  const rows = useMemo(() => {
    const needle = foldForSearch(filter);
    const matches = needle
      ? orderedCategories.filter((category) => ` ${foldForSearch(category.name)}`.includes(` ${needle}`))
      : orderedCategories;
    // While filtering, every match gets the same size.
    return needle ? pairs(matches) : toRows(matches);
  }, [filter, orderedCategories]);

  const openCategory = (category: CatalogCategory) => {
    trackCategoryView(category.id);
    navigation.navigate('ProductList', { categoryId: category.id, title: category.name });
  };

  const renderRow: ListRenderItem<Row> = ({ item, index }) => (
    <Animated.View entering={enterUp(index)} style={styles.row}>
      {item.items.map((category) => (
        <CategoryTile
          key={category.id}
          category={category}
          count={countByCategory.get(category.id) ?? 0}
          width={item.featured ? contentWidth : halfWidth}
          height={item.featured ? Math.round(contentWidth * 0.5) : Math.round(halfWidth * 1.08)}
          featured={item.featured}
          onPress={() => openCategory(category)}
        />
      ))}
    </Animated.View>
  );

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={renderRow}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={6}
      windowSize={7}
      ListHeaderComponent={
        <SearchField
          value={filter}
          onChangeText={setFilter}
          onClear={() => setFilter('')}
          placeholder="Caută o categorie"
          returnKeyType="done"
          enterKeyHint="done"
          accessibilityLabel="Caută o categorie"
          style={styles.filter}
        />
      }
      ListEmptyComponent={<EmptyState icon="grid-outline" title="Nicio categorie găsită" message="Încearcă alt cuvânt." />}
    />
  );
}

const pairs = (categories: CatalogCategory[]): Row[] => {
  const rows: Row[] = [];
  for (let index = 0; index < categories.length; index += 2) {
    const items = categories.slice(index, index + 2);
    rows.push({ key: `match-${items[0]?.id}`, items, featured: false });
  }
  return rows;
};

type CategoryTileProps = {
  category: CatalogCategory;
  count: number;
  width: number;
  height: number;
  featured: boolean;
  onPress: () => void;
};

function CategoryTile({ category, count, width, height, featured, onPress }: CategoryTileProps) {
  const countLabel = `${count.toLocaleString('ro-RO')} produse`;
  return (
    <Touchable
      onPress={onPress}
      pressedScale={0.97}
      style={[styles.tile, { width, height }]}
      accessibilityLabel={`${category.name}, ${countLabel}`}
    >
      {hasImageUrl(category.imageUrl) ? (
        <Image
          source={sizedImageUrl(category.imageUrl, width)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          recyclingKey={category.id}
        />
      ) : (
        <View style={styles.noImage}>
          <Ionicons name="grid-outline" size={28} color={colors.textInverseMuted} />
        </View>
      )}
      <LinearGradient
        colors={['rgba(12,11,10,0)', 'rgba(12,11,10,0.72)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tileText}>
        <AppText variant={featured ? 'title1' : 'headline'} tone="inverse" numberOfLines={2}>
          {category.name}
        </AppText>
        <AppText variant="footnote" tone="inverseMuted">
          {countLabel}
        </AppText>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: GAP },
  filter: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: GAP },
  tile: {
    borderRadius: radii.md,
    ...continuous,
    overflow: 'hidden',
    backgroundColor: colors.charcoal,
    justifyContent: 'flex-end',
  },
  noImage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tileText: { padding: spacing.sm, gap: 2 },
});

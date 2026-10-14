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
import {
  AppText,
  EmptyState,
  enterUp,
  ProductImage,
  SearchField,
  sizedImageUrl,
  Touchable,
} from '../ui';
import { categoryCover, type CategoryCover } from '../utils/categoryCover';
import { foldForSearch } from '../utils/search';

const GAP = spacing.sm;

type Row = { key: string; items: CatalogCategory[]; featured: boolean };

/** One wide tile first, then pairs: a rhythm instead of an even grid of identical boxes. */
const toRows = (categories: CatalogCategory[]): Row[] => {
  const rows: Row[] = [];
  let index = 0;
  if (categories.length > 0) {
    rows.push({
      key: `row-${categories[0]?.id}`,
      items: [categories[0] as CatalogCategory],
      featured: true,
    });
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
  const { orderedCategories, countByCategory, productsByCategory, trackCategoryView } = useApp();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('');
  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const contentWidth = Math.min(width, 700) - spacing.md * 2;
  const halfWidth = (contentWidth - GAP) / 2;

  const rows = useMemo(() => {
    const needle = foldForSearch(filter);
    const matches = needle
      ? orderedCategories.filter((category) =>
          ` ${foldForSearch(category.name)}`.includes(` ${needle}`),
        )
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
          cover={categoryCover(category, productsByCategory.get(category.id))}
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
      ListEmptyComponent={
        <EmptyState
          icon="grid-outline"
          title="Nicio categorie găsită"
          message="Încearcă alt cuvânt."
        />
      }
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
  cover: CategoryCover;
  count: number;
  width: number;
  height: number;
  featured: boolean;
  onPress: () => void;
};

function CategoryTile({
  category,
  cover,
  count,
  width,
  height,
  featured,
  onPress,
}: CategoryTileProps) {
  const countLabel = `${count.toLocaleString('ro-RO')} produse`;
  const photo = cover.kind === 'photo';

  return (
    <Touchable
      onPress={onPress}
      pressedScale={0.97}
      style={[styles.tile, photo ? styles.tilePhoto : styles.tileProduct, { width, height }]}
      accessibilityLabel={`${category.name}, ${countLabel}`}
    >
      {photo ? (
        <>
          <Image
            source={sizedImageUrl(cover.uri, width)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          <LinearGradient
            colors={['rgba(12,11,10,0)', 'rgba(12,11,10,0.72)']}
            locations={[0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        // No collection photo: a product from the category, shown whole on the light well, with dark text.
        <View style={styles.productCover}>
          <View style={styles.productBlend}>
            <ProductImage
              uri={cover.kind === 'product' ? sizedImageUrl(cover.uri, width) : undefined}
              iconSize={30}
            />
          </View>
        </View>
      )}
      <View style={styles.tileText}>
        <AppText
          variant={featured ? 'title1' : 'headline'}
          tone={photo ? 'inverse' : 'primary'}
          numberOfLines={2}
        >
          {category.name}
        </AppText>
        <AppText variant="footnote" tone={photo ? 'inverseMuted' : 'secondary'}>
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
    justifyContent: 'flex-end',
    isolation: 'isolate',
  },
  // Dark under photos (they end up under a dark scrim anyway), light for product covers.
  tilePhoto: { backgroundColor: colors.charcoal },
  tileProduct: { backgroundColor: colors.well },
  productCover: {
    ...StyleSheet.absoluteFill,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: 64,
    // The photo multiplies onto its direct parent, so the grey lives here (white backgrounds disappear).
    backgroundColor: colors.well,
    isolation: 'isolate',
  },
  productBlend: { flex: 1, mixBlendMode: 'multiply' },
  tileText: { padding: spacing.sm, gap: 2 },
});

import { useNavigation, useScrollToTop } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import Animated from 'react-native-reanimated';

import type { CatalogCategory } from '../data/catalog';
import type { Department } from '../data/departments';
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
import { categoryCover, departmentCover, type CategoryCover } from '../utils/categoryCover';
import { foldForSearch } from '../utils/search';

const GAP = spacing.sm;

type Row =
  | { kind: 'department'; key: string; department: Department }
  | { kind: 'matches'; key: string; items: CatalogCategory[] };

export function CategoriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CategoriesStackParamList>>();
  const { categories, departments, countByCategory, productsByCategory, trackCategoryView } =
    useApp();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('');
  const listRef = useRef<FlatList<Row>>(null);
  useScrollToTop(listRef);

  const contentWidth = Math.min(width, 700) - spacing.md * 2;
  const halfWidth = (contentWidth - GAP) / 2;

  // Browsing: one block per department. Filtering: every matching collection, two per row.
  const rows = useMemo<Row[]>(() => {
    const needle = foldForSearch(filter);
    if (!needle) {
      return departments.map((department) => ({
        kind: 'department',
        key: department.id,
        department,
      }));
    }
    const matches = categories.filter(
      (category) =>
        (countByCategory.get(category.id) ?? 0) > 0 &&
        ` ${foldForSearch(category.name)}`.includes(` ${needle}`),
    );
    const result: Row[] = [];
    for (let index = 0; index < matches.length; index += 2) {
      result.push({
        kind: 'matches',
        key: `match-${matches[index]?.id}`,
        items: matches.slice(index, index + 2),
      });
    }
    return result;
  }, [categories, countByCategory, departments, filter]);

  const openCategory = (category: CatalogCategory) => {
    trackCategoryView(category.id);
    navigation.navigate('ProductList', { categoryId: category.id, title: category.name });
  };

  const openDepartment = (department: Department) => {
    if (department.lead) trackCategoryView(department.lead.id);
    navigation.navigate('ProductList', { departmentId: department.id, title: department.name });
  };

  const renderRow: ListRenderItem<Row> = ({ item, index }) => {
    if (item.kind === 'matches') {
      return (
        <Animated.View entering={enterUp(index)} style={styles.matchRow}>
          {item.items.map((category) => (
            <CoverTile
              key={category.id}
              title={category.name}
              subtitle={`${(countByCategory.get(category.id) ?? 0).toLocaleString('ro-RO')} produse`}
              cover={categoryCover(category, productsByCategory.get(category.id))}
              width={halfWidth}
              height={Math.round(halfWidth * 0.9)}
              onPress={() => openCategory(category)}
            />
          ))}
        </Animated.View>
      );
    }

    const { department } = item;
    return (
      <Animated.View entering={enterUp(index)} style={styles.department}>
        <CoverTile
          title={department.name}
          subtitle={`${department.productCount.toLocaleString('ro-RO')} produse`}
          cover={departmentCover(department.lead, department.children, productsByCategory)}
          width={contentWidth}
          height={Math.round(contentWidth * 0.42)}
          large
          onPress={() => openDepartment(department)}
        />
        {department.children.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pills}
            style={styles.pillsScroller}
          >
            {department.children.map((child) => (
              <Touchable
                key={child.id}
                onPress={() => openCategory(child)}
                pressedScale={0.94}
                haptic="selection"
                accessibilityLabel={child.name}
                style={styles.pill}
              >
                <AppText variant="subheadMedium" numberOfLines={1}>
                  {child.name}
                </AppText>
              </Touchable>
            ))}
          </ScrollView>
        ) : null}
      </Animated.View>
    );
  };

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
      initialNumToRender={5}
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

type CoverTileProps = {
  title: string;
  subtitle: string;
  cover: CategoryCover;
  width: number;
  height: number;
  large?: boolean;
  onPress: () => void;
};

function CoverTile({
  title,
  subtitle,
  cover,
  width,
  height,
  large = false,
  onPress,
}: CoverTileProps) {
  const photo = cover.kind === 'photo';

  return (
    <Touchable
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.tile, photo ? styles.tilePhoto : styles.tileProduct, { width, height }]}
      accessibilityLabel={`${title}, ${subtitle}`}
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
            colors={['rgba(12,11,10,0)', 'rgba(12,11,10,0.74)']}
            locations={[0.3, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        // No collection photo: a product from it, shown whole on the light well, with dark text.
        <View style={[styles.productCover, large && styles.productCoverLarge]}>
          <View style={styles.productBlend}>
            <ProductImage
              uri={cover.kind === 'product' ? sizedImageUrl(cover.uri, width) : undefined}
              iconSize={30}
            />
          </View>
        </View>
      )}
      <View
        style={[
          styles.tileText,
          large && styles.tileTextLarge,
          large && !photo && styles.tileTextBeside,
        ]}
      >
        <AppText
          variant={large ? 'title1' : 'headline'}
          tone={photo ? 'inverse' : 'primary'}
          numberOfLines={2}
        >
          {title}
        </AppText>
        <AppText variant="footnote" tone={photo ? 'inverseMuted' : 'secondary'}>
          {subtitle}
        </AppText>
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.xl },
  filter: { marginBottom: -spacing.xs },
  department: { gap: spacing.sm },
  matchRow: { flexDirection: 'row', gap: GAP, marginBottom: -spacing.sm },
  // Pills run edge to edge while the cards keep the page margin.
  pillsScroller: { marginHorizontal: -spacing.md },
  pills: { paddingHorizontal: spacing.md, gap: spacing.xs },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.well,
    justifyContent: 'center',
  },
  tile: {
    borderRadius: radii.md,
    ...continuous,
    overflow: 'hidden',
    justifyContent: 'flex-end',
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
  // Wide cards: the product sits on the right, the title on the left.
  productCoverLarge: { left: '45%', paddingBottom: spacing.sm },
  productBlend: { flex: 1, mixBlendMode: 'multiply' },
  tileText: { padding: spacing.sm, gap: 2 },
  tileTextLarge: { padding: spacing.lg },
  tileTextBeside: { paddingRight: '45%' },
});

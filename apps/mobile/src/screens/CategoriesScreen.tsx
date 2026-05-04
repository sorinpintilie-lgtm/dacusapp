import { Ionicons } from '@expo/vector-icons';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';

import type { CatalogCategory } from '../data/catalog';
import { Skeleton } from '../components/Skeleton';
import { colors, spacing } from '../theme/tokens';
import { fixRomanianMojibake } from '../utils/string';
import type { ScreenStyles } from './screenTypes';

type CategoriesScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  categories: CatalogCategory[];
  countByCategory: Map<string, number>;
  onOpenCategory: (categoryId: string) => void;
  hasImageUrl: (value: string | undefined) => value is string;
};

export const CategoriesScreen = ({
  styles,
  isLoading,
  categories,
  countByCategory,
  onOpenCategory,
  hasImageUrl,
}: CategoriesScreenProps) => {
  if (isLoading) {
    return (
      <View style={[styles.pageContainer, styles.stackLarge]}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="apps-outline" size={22} color={colors.brandRed} />
          <Text style={styles.pageHeading}>Toate categoriile</Text>
        </View>
        <Text style={styles.bodyMuted}>Intră direct în colecția care te interesează.</Text>
        <Skeleton height={108} />
        <Skeleton height={108} />
        <Skeleton height={108} />
      </View>
    );
  }

  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.stackLarge}
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={6}
      removeClippedSubviews
      ListHeaderComponent={
        <View>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="apps-outline" size={22} color={colors.brandRed} />
            <Text style={styles.pageHeading}>Toate categoriile</Text>
          </View>
          <Text style={styles.bodyMuted}>Intră direct în colecția care te interesează.</Text>
        </View>
      }
      renderItem={({ item: category }) => (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.categoryCard}
          onPress={() => onOpenCategory(category.id)}
        >
          <View style={styles.categoryContent}>
            <Text style={styles.categoryTitle}>{fixRomanianMojibake(category.name)}</Text>
            <Text style={styles.categoryDescription} numberOfLines={2}>
              {fixRomanianMojibake(
                category.description?.trim() || 'Explorează produsele din această categorie.',
              )}
            </Text>
            <Text style={styles.categoryMeta}>{countByCategory.get(category.id) ?? 0} produse</Text>
          </View>
          <View style={styles.categoryRight}>
            {hasImageUrl(category.imageUrl) ? (
              <Image
                source={{ uri: category.imageUrl }}
                style={styles.categoryThumb}
                resizeMode="cover"
              />
            ) : null}
            <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      )}
    />
  );
};

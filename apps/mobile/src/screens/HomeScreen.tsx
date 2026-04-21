import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { ProductCard } from '../components/ProductCard';
import { Skeleton } from '../components/Skeleton';
import { AnimatedEntrance } from '../components/UXComponents';
import { formatPrice } from '../utils/catalogFilters';
import type { ScreenStyles } from './screenTypes';

type HomeSection = {
  category: CatalogCategory;
  products: CatalogProduct[];
};

type HomeScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  catalogError: string | null;
  featuredCategories: CatalogCategory[];
  homeCategories: CatalogCategory[];
  homeProducts: CatalogProduct[];
  continueBrowsingProducts: CatalogProduct[];
  continueBrowsingCategories: CatalogCategory[];
  sectionsByCategory: HomeSection[];
  hasMoreCategories: boolean;
  onOpenCategories: () => void;
  onOpenLoyalty: () => void;
  onOpenProducts: () => void;
  onOpenCategory: (categoryId: string) => void;
  onOpenProduct: (productId: string) => void;
  onAddToCart: (productId: string) => void;
};

const HOME_FEATURED_PRODUCTS_LIMIT = 6;
const HOME_HERO_TAGS_LIMIT = 3;
const HOME_CATEGORY_TILES_LIMIT = 6;

const hasImageUrl = (value: string | undefined): value is string =>
  !!value && /^https?:\/\//.test(value);

export const HomeScreen = ({
  styles,
  isLoading,
  catalogError,
  featuredCategories,
  homeCategories,
  homeProducts,
  continueBrowsingProducts,
  continueBrowsingCategories,
  sectionsByCategory,
  hasMoreCategories,
  onOpenCategories,
  onOpenLoyalty,
  onOpenProducts,
  onOpenCategory,
  onOpenProduct,
  onAddToCart,
}: HomeScreenProps) => {
  const popularCategories = featuredCategories.length > 0 ? featuredCategories : homeCategories;
  const heroTags = popularCategories.slice(0, HOME_HERO_TAGS_LIMIT);
  const heroProduct = homeProducts[0] ?? continueBrowsingProducts[0] ?? null;
  const heroImageUrl = heroProduct?.thumbnailUrl ?? heroProduct?.imageUrl;
  const heroHeadline =
    typeof heroProduct?.name === 'string' && heroProduct.name.trim().length > 0
      ? heroProduct.name.trim().toUpperCase()
      : 'SCULE ȘI ECHIPAMENTE PENTRU LUCRU SERIOS';
  const heroPriceLabel =
    typeof heroProduct?.priceRon === 'number' ? formatPrice(heroProduct.priceRon) : null;
  const heroSubline =
    typeof heroProduct?.brand === 'string' && heroProduct.brand.length > 0
      ? `${heroProduct.brand} · Livrare rapidă din stoc Dacus`
      : 'Scule, echipamente și consumabile pentru șantier, atelier și mentenanță';

  const categoryProductCount = sectionsByCategory.reduce<Map<string, number>>((acc, section) => {
    acc.set(section.category.id, section.products.length);
    return acc;
  }, new Map());

  return (
    <View style={styles.stackLarge}>
      <AnimatedEntrance>
        <View style={styles.homeHeroShell}>
          <View style={styles.homeHeroDiagonal} />
          <View style={styles.homeHeroStripeOne} />
          <View style={styles.homeHeroStripeTwo} />
          <View style={styles.homeHeroRedOrb} />

          <View style={styles.homeHeroLayout}>
            <View style={styles.homeHeroMediaWrap}>
              <View style={styles.homeHeroMediaCard}>
                {hasImageUrl(heroImageUrl) ? (
                  <Image
                    source={{ uri: heroImageUrl }}
                    style={styles.homeHeroMediaImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.homeHeroMediaFallback}>
                    <Text style={styles.homeHeroMediaFallbackText}>DACUS</Text>
                  </View>
                )}
              </View>

              {heroPriceLabel ? (
                <View style={styles.homeHeroPriceBadge}>
                  <Text style={styles.homeHeroPriceCaption}>de la</Text>
                  <Text style={styles.homeHeroPriceValue}>{heroPriceLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.homeHeroContent}>
              <Text style={styles.homeHeroEyebrow}>DACUS.RO · OFERTE PRACTICE</Text>
              <Text style={styles.homeHeroTitle} numberOfLines={3}>
                {heroHeadline}
              </Text>
              <Text style={styles.homeHeroSubtitle}>{heroSubline}</Text>

              {heroTags.length > 0 ? (
                <View style={styles.homeHeroTagRow}>
                  {heroTags.map((category) => (
                    <View key={category.id} style={styles.homeHeroTag}>
                      <Text style={styles.homeHeroTagText}>{category.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.homeHeroActions}>
                <TouchableOpacity style={styles.homeHeroPrimaryButton} onPress={onOpenProducts}>
                  <Text style={styles.homeHeroPrimaryButtonText}>Intră în catalog</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.homeHeroGhostButton} onPress={onOpenCategories}>
                  <Text style={styles.homeHeroGhostButtonText}>Vezi categoriile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </AnimatedEntrance>

      {catalogError ? (
        <View style={styles.homeAlertCard}>
          <Text style={styles.homeAlertText}>{catalogError}</Text>
        </View>
      ) : null}

      <AnimatedEntrance delay={60}>
        <View style={styles.homeValueStrip}>
          <View style={styles.homeValuePill}>
            <Text style={styles.homeValueTitle}>Livrare rapidă</Text>
            <Text style={styles.homeValueMeta}>24-48h în majoritatea zonelor</Text>
          </View>
          <View style={styles.homeValuePill}>
            <Text style={styles.homeValueTitle}>Stoc verificat</Text>
            <Text style={styles.homeValueMeta}>{homeProducts.length} produse active azi</Text>
          </View>
          <View style={styles.homeValuePill}>
            <Text style={styles.homeValueTitle}>Suport dedicat</Text>
            <Text style={styles.homeValueMeta}>consultanță înainte de comandă</Text>
          </View>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={100}>
        <View style={styles.homeSectionCard}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionLabel}>Alege o categorie</Text>
            <TouchableOpacity onPress={onOpenCategories}>
              <Text style={styles.seeAll}>Vezi toate</Text>
            </TouchableOpacity>
          </View>

          {popularCategories.length > 0 ? (
            <View style={styles.homeCategoryGrid}>
              {popularCategories.slice(0, HOME_CATEGORY_TILES_LIMIT).map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.homeCategoryTile}
                  onPress={() => onOpenCategory(category.id)}
                >
                  <Text style={styles.homeCategoryTileName} numberOfLines={2}>
                    {category.name}
                  </Text>
                  <Text style={styles.homeCategoryTileMeta}>
                    {categoryProductCount.get(category.id) ?? 0} produse
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.bodyMuted}>Categorii indisponibile momentan.</Text>
          )}
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={130}>
        <View style={styles.homeSectionCard}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionLabel}>Produse recomandate azi</Text>
            <TouchableOpacity onPress={onOpenProducts}>
              <Text style={styles.seeAll}>Catalog complet</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              <Skeleton height={248} width={188} />
              <Skeleton height={248} width={188} />
              <Skeleton height={248} width={188} />
            </ScrollView>
          ) : homeProducts.length === 0 ? (
            <Text style={styles.bodyMuted}>
              Produsele recomandate se încarcă. Revino în câteva momente.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {homeProducts.slice(0, HOME_FEATURED_PRODUCTS_LIMIT).map((product) => (
                <View key={product.id} style={styles.railCardWrap}>
                  <ProductCard
                    product={product}
                    compact
                    onOpen={onOpenProduct}
                    onAdd={onAddToCart}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </AnimatedEntrance>

      {continueBrowsingProducts.length > 0 || continueBrowsingCategories.length > 0 ? (
        <AnimatedEntrance delay={170}>
          <View style={styles.homeSectionCard}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionLabel}>Continuă rapid</Text>
            </View>

            {continueBrowsingCategories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {continueBrowsingCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categoryChip}
                    onPress={() => onOpenCategory(category.id)}
                  >
                    <Text style={styles.categoryChipText}>{category.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {continueBrowsingProducts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {continueBrowsingProducts.map((product) => (
                  <View key={product.id} style={styles.railCardWrap}>
                    <ProductCard
                      product={product}
                      compact
                      onOpen={onOpenProduct}
                      onAdd={onAddToCart}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        </AnimatedEntrance>
      ) : null}

      <AnimatedEntrance delay={200}>
        <View style={styles.homeTrustCard}>
          <Text style={styles.sectionLabel}>Comandă clar, fără surprize</Text>
          <Text style={styles.bodyMuted}>
            Retur simplu 14 zile, verificare stoc și suport Dacus înainte de finalizare.
          </Text>
          <View style={styles.homeTrustActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onOpenProducts}>
              <Text style={styles.primaryButtonText}>Continuă cumpărăturile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onOpenLoyalty}>
              <Text style={styles.secondaryButtonText}>Deschide zona fidelitate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedEntrance>

      {sectionsByCategory.length > 0 && hasMoreCategories ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onOpenCategories}>
          <Text style={styles.secondaryButtonText}>Vezi toate categoriile</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

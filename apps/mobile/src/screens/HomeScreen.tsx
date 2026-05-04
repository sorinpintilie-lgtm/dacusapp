import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { ProductCard } from '../components/ProductCard';
import { Skeleton } from '../components/Skeleton';
import { AnimatedEntrance } from '../components/UXComponents';
import { formatPrice } from '../utils/catalogFilters';
import { fixRomanianMojibake } from '../utils/string';
import type { ScreenStyles } from './screenTypes';
import { colors, spacing } from '../theme/tokens';

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

const HOME_FEATURED_PRODUCTS_LIMIT = 8;
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
  const { width } = useWindowDimensions();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const popularCategories = featuredCategories.length > 0 ? featuredCategories : homeCategories;
  const heroProducts = [...homeProducts, ...continueBrowsingProducts].slice(0, 5);
  const visualShelves = sectionsByCategory.slice(0, 3);
  const heroSlides = heroProducts.length > 0 ? heroProducts : [];

  const categoryProductCount = sectionsByCategory.reduce<Map<string, number>>((acc, section) => {
    acc.set(section.category.id, section.products.length);
    return acc;
  }, new Map());

  const heroSlideWidth = Math.max(280, width - 32);
  const renderedHeroSlides = heroSlides.length > 0 ? heroSlides : [null];

  return (
    <View style={styles.stackLarge}>
      <AnimatedEntrance>
        <ScrollView
          horizontal
          pagingEnabled
          decelerationRate="fast"
          snapToInterval={heroSlideWidth}
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.homeHeroCarousel}
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / heroSlideWidth);
            setActiveHeroIndex(nextIndex);
          }}
        >
          {renderedHeroSlides.map((heroProduct, index) => {
            const heroImageUrl = heroProduct?.thumbnailUrl ?? heroProduct?.imageUrl;
            const heroHeadline =
              typeof heroProduct?.name === 'string' && heroProduct.name.trim().length > 0
                ? fixRomanianMojibake(heroProduct.name.trim())
                : 'Scule și echipamente pentru profesioniști';
            const heroPriceLabel =
              typeof heroProduct?.priceRon === 'number' ? formatPrice(heroProduct.priceRon) : null;

            return (
              <View
                key={heroProduct?.id ?? `hero-${index}`}
                style={[styles.homeHeroSlide, { width: heroSlideWidth }]}
              >
                <View style={styles.homeHeroShell}>
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
                    </View>

                    <View style={styles.homeHeroContentPanel}>
                      <View style={styles.homeHeroContent}>
                        <Text style={styles.homeHeroTitle} numberOfLines={4}>
                          {heroHeadline}
                        </Text>

                        {heroPriceLabel ? (
                          <View style={styles.homeHeroPriceBlock}>
                            <Text style={styles.homeHeroPriceLabel}>Preț</Text>
                            <Text style={styles.homeHeroPriceMain}>{heroPriceLabel}</Text>
                          </View>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={styles.homeHeroPrimaryButton}
                        onPress={() =>
                          heroProduct?.id ? onOpenProduct(heroProduct.id) : onOpenProducts()
                        }
                      >
                        <Text style={styles.homeHeroPrimaryButtonText}>Vezi produs</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
        {renderedHeroSlides.length > 1 ? (
          <View style={styles.homeHeroDots}>
            {renderedHeroSlides.map((heroProduct, index) => (
              <View
                key={`dot-${heroProduct?.id ?? index}`}
                style={[styles.homeHeroDot, activeHeroIndex === index && styles.homeHeroDotActive]}
              />
            ))}
          </View>
        ) : null}
      </AnimatedEntrance>

      <AnimatedEntrance delay={55}>
        <View style={styles.homeSectionCard}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionHeadLeft}>
              <Ionicons name="speedometer-outline" size={18} color={colors.brandRed} />
              <Text style={styles.sectionLabel}>Intră rapid în zonele populare</Text>
            </View>
            <TouchableOpacity onPress={onOpenCategories} style={styles.seeAllButton}>
              <Text style={styles.seeAll}>Vezi toate</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.homeCategoryCarousel}
          >
            {popularCategories.slice(0, HOME_CATEGORY_TILES_LIMIT + 2).map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.homeCategoryCarouselCard, styles.homeCategoryCarouselCardAccent]}
                onPress={() => onOpenCategory(category.id)}
              >
                <Text style={styles.homeCategoryCarouselTitle} numberOfLines={2}>
                  {fixRomanianMojibake(category.name)}
                </Text>
                <Text style={styles.homeCategoryCarouselMeta} numberOfLines={1}>
                  {categoryProductCount.get(category.id) ?? 0} produse
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </AnimatedEntrance>

      {catalogError ? (
        <View style={styles.homeAlertCard}>
          <Text style={styles.homeAlertText}>{fixRomanianMojibake(catalogError)}</Text>
        </View>
      ) : null}

      <AnimatedEntrance delay={82}>
        <View style={styles.homePromoRibbon}>
          <View style={styles.homePromoBadge}>
            <Ionicons name="rocket-outline" size={16} color={colors.brandRed} />
            <Text style={styles.homePromoBadgeTitle}>Livrare rapidă</Text>
            <Text style={styles.homePromoBadgeMeta}>24-48h pentru produse din stoc</Text>
          </View>
          <View style={styles.homePromoBadge}>
            <Ionicons name="pricetag-outline" size={16} color={colors.brandRed} />
            <Text style={styles.homePromoBadgeTitle}>Promoții curate</Text>
            <Text style={styles.homePromoBadgeMeta}>oferte clare, direct în app</Text>
          </View>
          <View style={styles.homePromoBadge}>
            <Ionicons name="star-outline" size={16} color={colors.brandAmber} />
            <Text style={styles.homePromoBadgeTitle}>Fidelitate</Text>
            <Text style={styles.homePromoBadgeMeta}>puncte și vouchere la fiecare comandă</Text>
          </View>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={108}>
        <View style={[styles.homeSectionCard, styles.homeFeaturedSectionCard]}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionHeadLeft}>
              <Ionicons name="star-outline" size={18} color={colors.brandAmber} />
              <Text style={styles.sectionLabel}>Produse recomandate azi</Text>
            </View>
            <TouchableOpacity onPress={onOpenProducts} style={styles.seeAllButton}>
              <Text style={styles.seeAll}>Catalog complet</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.homeFeaturedCarousel}
            >
              <Skeleton height={256} width={206} />
              <Skeleton height={256} width={206} />
              <Skeleton height={256} width={206} />
            </ScrollView>
          ) : homeProducts.length === 0 ? (
            <Text style={styles.bodyMuted}>
              Produsele recomandate se încarcă. Revino în câteva momente.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.homeFeaturedCarousel}
            >
              {homeProducts.slice(0, HOME_FEATURED_PRODUCTS_LIMIT).map((product) => (
                <View key={product.id} style={styles.homeFeaturedCardWrap}>
                  <ProductCard
                    product={{
                      ...product,
                      name: fixRomanianMojibake(product.name),
                      brand: fixRomanianMojibake(product.brand),
                      stockLabel: fixRomanianMojibake(product.stockLabel),
                    }}
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

      {visualShelves.length > 0
        ? visualShelves.map((section, index) => (
            <AnimatedEntrance key={section.category.id} delay={132 + index * 28}>
              <View style={styles.homeShelfShowcase}>
                <View style={styles.homeShelfHeader}>
                  <View style={styles.homeShelfHeaderTop}>
                    <View style={styles.sectionHeadLeft}>
                      <Ionicons name="grid-outline" size={18} color={colors.brandRed} />
                      <Text style={styles.sectionLabel}>
                        {fixRomanianMojibake(section.category.name)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.homeShelfAction}
                      onPress={() => onOpenCategory(section.category.id)}
                    >
                      <Text style={styles.homeShelfActionText}>Vezi categorie</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.bodyMuted}>
                    {section.products.length} produse disponibile
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.homeShelfCarousel}
                >
                  {section.products.slice(0, 5).map((product) => (
                    <View key={product.id} style={styles.homeShelfCardWrap}>
                      <ProductCard
                        product={{
                          ...product,
                          name: fixRomanianMojibake(product.name),
                          brand: fixRomanianMojibake(product.brand),
                          stockLabel: fixRomanianMojibake(product.stockLabel),
                        }}
                        compact
                        onOpen={onOpenProduct}
                        onAdd={onAddToCart}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            </AnimatedEntrance>
          ))
        : null}

      <AnimatedEntrance delay={228}>
        <View style={styles.homeVisualCategoryBand}>
          <View style={styles.sectionHeadRow}>
            <View style={styles.sectionHeadLeft}>
              <Ionicons name="apps-outline" size={18} color={colors.brandBlue} />
              <Text style={styles.sectionLabel}>Categorii care merită deschise acum</Text>
            </View>
            <TouchableOpacity onPress={onOpenCategories} style={styles.seeAllButton}>
              <Text style={styles.seeAll}>Vezi toate</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.homeCategoryVisualCarousel}
          >
            {popularCategories.slice(0, HOME_CATEGORY_TILES_LIMIT + 2).map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.homeCategoryVisualCard, styles.homeCategoryVisualCardAccent]}
                onPress={() => onOpenCategory(category.id)}
              >
                <Text style={styles.homeCategoryVisualTitle} numberOfLines={2}>
                  {fixRomanianMojibake(category.name)}
                </Text>
                <Text style={styles.homeCategoryVisualMeta} numberOfLines={1}>
                  {categoryProductCount.get(category.id) ?? 0} produse
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </AnimatedEntrance>

      {continueBrowsingProducts.length > 0 || continueBrowsingCategories.length > 0 ? (
        <AnimatedEntrance delay={254}>
          <View style={styles.homeSectionCard}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionHeadLeft}>
                <Ionicons name="time-outline" size={18} color={colors.brandBlue} />
                <Text style={styles.sectionLabel}>Continuă rapid</Text>
              </View>
            </View>

            {continueBrowsingCategories.length > 0 ? (
              <View style={styles.homeChipWrap}>
                {continueBrowsingCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.categoryChip}
                    onPress={() => onOpenCategory(category.id)}
                  >
                    <Text style={styles.categoryChipText}>
                      {fixRomanianMojibake(category.name)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {continueBrowsingProducts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.homeCompactCarousel}
              >
                {continueBrowsingProducts.slice(0, 5).map((product) => (
                  <View key={product.id} style={styles.homeCompactCarouselCard}>
                    <ProductCard
                      product={{
                        ...product,
                        name: fixRomanianMojibake(product.name),
                        brand: fixRomanianMojibake(product.brand),
                        stockLabel: fixRomanianMojibake(product.stockLabel),
                      }}
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

      <AnimatedEntrance delay={282}>
        <View style={styles.homeTrustCard}>
          <View style={styles.sectionHeadLeft}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
            <Text style={styles.sectionLabel}>Comandă clar, fără surprize</Text>
          </View>
          <Text style={styles.bodyMuted}>
            Retur simplu 14 zile, verificare stoc și suport Dacus înainte de finalizare.
          </Text>
          <View style={styles.homeTrustActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onOpenProducts}>
              <Ionicons
                name="bag-handle-outline"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: spacing.xs }}
              />
              <Text style={styles.primaryButtonText}>Continuă cumpărăturile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onOpenLoyalty}>
              <Ionicons
                name="star-outline"
                size={16}
                color={colors.brandRed}
                style={{ marginRight: spacing.xs }}
              />
              <Text style={styles.secondaryButtonText}>Deschide zona fidelitate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedEntrance>

      {sectionsByCategory.length > 0 && hasMoreCategories ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onOpenCategories}>
          <Ionicons
            name="grid-outline"
            size={16}
            color={colors.brandRed}
            style={{ marginRight: spacing.xs }}
          />
          <Text style={styles.secondaryButtonText}>Vezi toate categoriile</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

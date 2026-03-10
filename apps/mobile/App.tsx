import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import dacusLogo from './assets/icon.png';
import { mobileEnv } from './src/config/env';
import { loyaltySummary, type CatalogProduct } from './src/data/catalog';
import { ProductCard } from './src/components/ProductCard';
import { Skeleton } from './src/components/Skeleton';
import { useCatalog } from './src/hooks/useCatalog';
import { colors, radii, spacing, typography } from './src/theme/tokens';
import {
  filterProducts,
  formatPrice,
  type PriceFilterOption,
  type SortOption,
} from './src/utils/catalogFilters';

type Page = 'home' | 'categories' | 'products' | 'productDetails' | 'cart' | 'loyalty' | 'account';
type CartLine = { productId: string; quantity: number };
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const loyaltyTiers = [
  { name: 'Bronze', min: 0, max: 1499 },
  { name: 'Silver', min: 1500, max: 4999 },
  { name: 'Gold', min: 5000, max: Number.POSITIVE_INFINITY },
];

const navConfig: Array<{ target: Page; label: string; icon: IconName; activeIcon?: IconName }> = [
  { target: 'home', label: 'Acasă', icon: 'view-dashboard-outline', activeIcon: 'view-dashboard' },
  { target: 'categories', label: 'Categorii', icon: 'shape-outline', activeIcon: 'shape' },
  { target: 'cart', label: 'Coș', icon: 'basket-outline', activeIcon: 'basket' },
  { target: 'loyalty', label: 'Fidelitate', icon: 'medal-outline', activeIcon: 'medal' },
  { target: 'account', label: 'Cont', icon: 'card-account-details-outline', activeIcon: 'card-account-details' },
];

const HOME_SECTIONS_LIMIT = 6;
const HOME_FEATURED_PRODUCTS_LIMIT = 6;
const HOME_PRODUCTS_PER_SECTION = 6;

const hasImageUrl = (value: string | undefined): value is string => !!value && /^https?:\/\//.test(value);

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    categories,
    products,
    selectedCategory,
    selectedCategoryId,
    selectedProduct,
    setSelectedCategoryId,
    setSelectedProductId,
    productsById,
    countByCategory,
    catalogError,
    catalogLoading,
    catalogMeta,
  } = useCatalog();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showBackTop, setShowBackTop] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>('toate');
  const [priceFilter, setPriceFilter] = useState<PriceFilterOption>('toate');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('relevanta');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const scrollRef = useRef<ScrollView>(null);
  const viewport = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const zoomCloseTop = insets.top + spacing.sm;

  const isLoading = catalogLoading;

  const categoryScopedProducts = useMemo(
    () => (page === 'products' ? products.filter((item) => item.categoryId === selectedCategoryId) : products),
    [page, products, selectedCategoryId],
  );

  const availableBrands = useMemo(
    () => Array.from(new Set(categoryScopedProducts.map((item) => item.brand))).sort((a, b) => a.localeCompare(b, 'ro')),
    [categoryScopedProducts],
  );

  const filteredProducts = useMemo(() => {
    if (page !== 'products') return [];

    const source = searchQuery.trim() ? products : categoryScopedProducts;

    return filterProducts(source, {
      query: searchQuery,
      brandFilter,
      priceFilter,
      onlyDiscount,
      onlyInStock,
      sortOption,
    });
  }, [brandFilter, categoryScopedProducts, onlyDiscount, onlyInStock, page, priceFilter, products, searchQuery, sortOption]);

  const cartItems = useMemo(
    () =>
      cart.reduce<Array<{ productId: string; quantity: number; product: CatalogProduct }>>((acc, line) => {
        const product = productsById.get(line.productId);
        if (product) {
          acc.push({ ...line, product });
        }
        return acc;
      }, []),
    [cart, productsById],
  );

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.priceRon * item.quantity, 0);

  const sectionsByCategory = useMemo(
    () => {
      const byCategory = new Map<string, CatalogProduct[]>();
      products.forEach((item) => {
        const list = byCategory.get(item.categoryId);
        if (list) {
          list.push(item);
        } else {
          byCategory.set(item.categoryId, [item]);
        }
      });

      return categories
        .map((category) => ({ category, products: byCategory.get(category.id) ?? [] }))
        .filter((section) => section.products.length > 0)
        .slice(0, HOME_SECTIONS_LIMIT);
    },
    [categories, products],
  );

  const selectedCategoryProducts = useMemo(
    () => products.filter((item) => item.categoryId === selectedCategoryId),
    [products, selectedCategoryId],
  );

  const filterCount =
    Number(brandFilter !== 'toate') +
    Number(priceFilter !== 'toate') +
    Number(onlyDiscount) +
    Number(onlyInStock) +
    Number(sortOption !== 'relevanta');

  useEffect(() => {
    if (brandFilter !== 'toate' && !availableBrands.includes(brandFilter)) {
      setBrandFilter('toate');
    }
  }, [availableBrands, brandFilter]);

  const currentTierTarget = useMemo(() => {
    if (loyaltySummary.tier === 'Gold') return 5000;
    if (loyaltySummary.tier === 'Silver') return 5000;
    return 1500;
  }, []);

  const estimatedCurrentSpend = Math.max(0, currentTierTarget - loyaltySummary.nextTierSpendRon);
  const tierProgress = loyaltySummary.tier === 'Gold' ? 1 : Math.min(1, estimatedCurrentSpend / currentTierTarget);
  const voucherValueRon = Math.floor(loyaltySummary.points / 100) * 5;

  const addToCart = (productId: string) => {
    if (!productId) return;
    setCart((prev) => {
      const found = prev.find((line) => line.productId === productId);
      if (!found) return [...prev, { productId, quantity: 1 }];
      return prev.map((line) =>
        line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.productId === productId ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const openCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setPage('products');
  };

  const openProduct = (productId: string) => {
    setSelectedProductId(productId);
    setPage('productDetails');
  };

  const openImageZoom = (url: string | undefined) => {
    if (!hasImageUrl(url)) return;
    setZoomLevel(1);
    setZoomImageUrl(url);
  };

  const closeImageZoom = () => {
    setZoomImageUrl(null);
    setZoomLevel(1);
  };

  const resetFilters = () => {
    setBrandFilter('toate');
    setPriceFilter('toate');
    setOnlyDiscount(false);
    setOnlyInStock(true);
    setSortOption('relevanta');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length > 0 && page !== 'products') {
      setPage('products');
    }
  };

  const productList = () => {
    if (isLoading) {
      return (
        <View style={styles.stackLarge}>
          <Skeleton height={18} width="44%" />
          <View style={styles.gridWrap}>
            <Skeleton height={248} width="48%" />
            <Skeleton height={248} width="48%" />
            <Skeleton height={248} width="48%" />
            <Skeleton height={248} width="48%" />
          </View>
        </View>
      );
    }

    if (filteredProducts.length === 0) {
      return <Text style={styles.emptyText}>Nu există produse pentru filtrarea curentă.</Text>;
    }

    return (
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={styles.gridListContent}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <View style={styles.gridCell}>
            <ProductCard product={item} onOpen={openProduct} onOpenImage={openImageZoom} onAdd={addToCart} />
          </View>
        )}
      />
    );
  };

  const onScrollMain = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    setShowBackTop(event.nativeEvent.contentOffset.y > 420);
  };

  const backToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const renderPage = () => {
    if (page === 'categories') {
      return (
        <View style={styles.stackLarge}>
          <Text style={styles.pageHeading}>Toate categoriile</Text>
          <Text style={styles.bodyMuted}>Intră direct în colecția care te interesează.</Text>
          {isLoading ? (
            <>
              <Skeleton height={108} />
              <Skeleton height={108} />
              <Skeleton height={108} />
            </>
          ) : (
            categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                activeOpacity={0.9}
                style={styles.categoryCard}
                onPress={() => openCategory(category.id)}
              >
                <View style={styles.categoryContent}>
                  <Text style={styles.categoryTitle}>{category.name}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                  <Text style={styles.categoryMeta}>
                    {countByCategory.get(category.id) ?? 0} produse
                  </Text>
                </View>
                <View style={styles.categoryRight}>
                  {hasImageUrl(category.imageUrl) ? (
                    <Image source={{ uri: category.imageUrl }} style={styles.categoryThumb} resizeMode="cover" />
                  ) : null}
                  <Text style={styles.categoryArrow}>›</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      );
    }

    if (page === 'products') {
      return (
        <View style={styles.stackLarge}>
          <Text style={styles.pageHeading}>{selectedCategory?.name ?? 'Produse'}</Text>
          <Text style={styles.bodyMuted}>
            {searchQuery.trim()
              ? `${filteredProducts.length} rezultate pentru „${searchQuery.trim()}”`
              : `${filteredProducts.length} din ${selectedCategoryProducts.length} produse în colecție`}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {categories.map((category) => {
              const active = category.id === selectedCategoryId;
              return (
                <TouchableOpacity
                  key={category.id}
                  activeOpacity={0.9}
                  onPress={() => setSelectedCategoryId(category.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.filterPanel}>
            <View style={styles.filterHeadRow}>
              <Text style={styles.filterTitle}>Filtrare avansată</Text>
              <TouchableOpacity style={styles.resetFilterButton} onPress={resetFilters}>
                <Text style={styles.resetFilterText}>Resetează</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Brand</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              <TouchableOpacity
                style={[styles.filterPill, brandFilter === 'toate' && styles.filterPillActive]}
                onPress={() => setBrandFilter('toate')}
              >
                <Text style={[styles.filterPillText, brandFilter === 'toate' && styles.filterPillTextActive]}>
                  Toate brandurile
                </Text>
              </TouchableOpacity>
              {availableBrands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={[styles.filterPill, brandFilter === brand && styles.filterPillActive]}
                  onPress={() => setBrandFilter(brand)}
                >
                  <Text style={[styles.filterPillText, brandFilter === brand && styles.filterPillTextActive]}>{brand}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Preț</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
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
                  onPress={() => setPriceFilter(item.key as PriceFilterOption)}
                >
                  <Text style={[styles.filterPillText, priceFilter === item.key && styles.filterPillTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleChip, onlyDiscount && styles.toggleChipActive]}
                onPress={() => setOnlyDiscount((prev) => !prev)}
              >
                <Text style={[styles.toggleChipText, onlyDiscount && styles.toggleChipTextActive]}>Doar promoții</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleChip, onlyInStock && styles.toggleChipActive]}
                onPress={() => setOnlyInStock((prev) => !prev)}
              >
                <Text style={[styles.toggleChipText, onlyInStock && styles.toggleChipTextActive]}>Doar în stoc</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Sortare</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              {[
                { key: 'relevanta', label: 'Relevanță' },
                { key: 'pretCrescator', label: 'Preț crescător' },
                { key: 'pretDescrescator', label: 'Preț descrescător' },
                { key: 'numeAZ', label: 'Nume A-Z' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.filterPill, sortOption === item.key && styles.filterPillActive]}
                  onPress={() => setSortOption(item.key as SortOption)}
                >
                  <Text style={[styles.filterPillText, sortOption === item.key && styles.filterPillTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterSummary}>{filterCount} filtre active</Text>
          </View>

          {productList()}
        </View>
      );
    }

    if (page === 'productDetails') {
      return isLoading ? (
        <View style={styles.stackLarge}>
          <Skeleton height={286} />
          <Skeleton height={22} width="70%" />
          <Skeleton height={14} width="46%" />
          <Skeleton height={58} />
          <Skeleton height={88} />
          <Skeleton height={48} />
        </View>
      ) : (
        <View style={styles.stackLarge}>
          <View style={styles.detailsHeroCard}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => openImageZoom(selectedProduct?.imageUrl)}>
              {hasImageUrl(selectedProduct?.imageUrl) || hasImageUrl(selectedProduct?.thumbnailUrl) ? (
                <Image
                  source={{ uri: selectedProduct.imageUrl ?? selectedProduct.thumbnailUrl }}
                  style={styles.detailsMedia}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.detailsMedia} />
              )}
            </TouchableOpacity>
            <View style={styles.stockPillDetails}>
              <Text style={styles.stockPillText}>{selectedProduct?.stockLabel}</Text>
            </View>
          </View>

          <View style={styles.stackSmall}>
            <Text style={styles.detailsTitle}>{selectedProduct?.name}</Text>
            <Text style={styles.detailsSub}>{selectedProduct?.brand}</Text>
          </View>

          <View style={styles.detailsPriceRow}>
            <Text style={styles.detailsPrice}>{formatPrice(selectedProduct?.priceRon)}</Text>
            {typeof selectedProduct?.oldPriceRon === 'number' && selectedProduct.oldPriceRon > selectedProduct.priceRon ? (
              <Text style={styles.detailsOldPrice}>{formatPrice(selectedProduct.oldPriceRon)}</Text>
            ) : null}
          </View>

          <View style={styles.detailsActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => addToCart(selectedProduct?.id ?? '')}>
              <Text style={styles.primaryButtonText}>Adaugă în coș</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                addToCart(selectedProduct?.id ?? '');
                setPage('cart');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cumpără acum</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.benefitRow}>
            <View style={styles.benefitCard}>
              <Text style={styles.benefitTitle}>Livrare rapidă</Text>
              <Text style={styles.benefitText}>Curier 24-48h în majoritatea localităților.</Text>
            </View>
            <View style={styles.benefitCard}>
              <Text style={styles.benefitTitle}>Retur simplu</Text>
              <Text style={styles.benefitText}>14 zile pentru retur conform politicii Dacus.</Text>
            </View>
          </View>

          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Descriere</Text>
            <Text style={styles.detailsDescription}>{selectedProduct?.description || 'Informații indisponibile momentan.'}</Text>
          </View>

          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Specificații rapide</Text>
            <Text style={styles.bodyText}>• Brand: {selectedProduct?.brand}</Text>
            <Text style={styles.bodyText}>• SKU: {selectedProduct?.sku || selectedProduct?.handle || 'N/A'}</Text>
            <Text style={styles.bodyText}>• Disponibilitate: {selectedProduct?.stockLabel}</Text>
          </View>
        </View>
      );
    }

    if (page === 'cart') {
      return (
        <View style={styles.stackLarge}>
          <Text style={styles.pageHeading}>Coșul tău</Text>
          {isLoading ? (
            <>
              <Skeleton height={90} />
              <Skeleton height={90} />
            </>
          ) : cartItems.length === 0 ? (
            <Text style={styles.emptyText}>Nu ai produse în coș.</Text>
          ) : (
            <>
              {cartItems.map((line) => (
                <View key={`${line.productId}-${line.product.categoryId}`} style={styles.cartRow}>
                  {hasImageUrl(line.product.thumbnailUrl) || hasImageUrl(line.product.imageUrl) ? (
                    <Image
                      source={{ uri: line.product.thumbnailUrl ?? line.product.imageUrl }}
                      style={styles.productThumbSmall}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.productThumbSmall} />
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {line.product.name}
                    </Text>
                    <Text style={styles.productPrice}>{formatPrice(line.product.priceRon)}</Text>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(line.productId, -1)}>
                        <Text style={styles.qtyText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{line.quantity}</Text>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(line.productId, 1)}>
                        <Text style={styles.qtyText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(cartTotal)}</Text>
              </View>
              <TouchableOpacity style={styles.primaryButton} activeOpacity={0.92}>
                <Text style={styles.primaryButtonText}>Continuă la checkout</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      );
    }

    if (page === 'loyalty') {
      return isLoading ? (
        <View style={styles.stackLarge}>
          <Skeleton height={120} />
          <Skeleton height={70} />
          <Skeleton height={70} />
        </View>
      ) : (
        <View style={styles.stackLarge}>
          <View style={styles.loyaltyHero}>
            <View style={styles.loyaltyHeroTop}>
              <Text style={styles.loyaltyTitle}>Program de fidelitate</Text>
              <Text style={styles.loyaltyTierTag}>{loyaltySummary.tier}</Text>
            </View>

            <Text style={styles.loyaltyPoints}>{loyaltySummary.points.toLocaleString('ro-RO')} puncte</Text>
            <Text style={styles.loyaltyMeta}>1 punct = 1 RON cheltuit • 100 puncte = 5 RON voucher</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(tierProgress * 100)}%` }]} />
            </View>

            <Text style={styles.loyaltyMeta}>
              {loyaltySummary.tier === 'Gold'
                ? 'Ai atins nivelul maxim. Beneficii premium active.'
                : `${loyaltySummary.nextTierSpendRon} RON până la nivelul următor`}
            </Text>
          </View>

          <View style={styles.loyaltyStatRow}>
            <View style={styles.loyaltyStatCard}>
              <Text style={styles.loyaltyStatLabel}>Valoare voucher disponibilă</Text>
              <Text style={styles.loyaltyStatValue}>{formatPrice(voucherValueRon)}</Text>
            </View>
            <View style={styles.loyaltyStatCard}>
              <Text style={styles.loyaltyStatLabel}>Puncte necesare / voucher</Text>
              <Text style={styles.loyaltyStatValue}>100</Text>
            </View>
          </View>

          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Niveluri</Text>
            {loyaltyTiers.map((tier) => {
              const active = tier.name === loyaltySummary.tier;
              return (
                <View key={tier.name} style={styles.tierRow}>
                  <Text style={[styles.tierName, active && styles.tierNameActive]}>{tier.name}</Text>
                  <Text style={styles.tierRange}>
                    {tier.max === Number.POSITIVE_INFINITY ? `${tier.min}+ RON` : `${tier.min} - ${tier.max} RON`}
                  </Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Generează voucher</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Afișează QR pentru puncte în magazin</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (page === 'account') {
      return isLoading ? (
        <View style={styles.stackLarge}>
          <Skeleton height={90} />
          <Skeleton height={70} />
          <Skeleton height={70} />
        </View>
      ) : (
        <View style={styles.stackLarge}>
          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Cont client</Text>
            <Text style={styles.bodyText}>Nume client</Text>
            <Text style={styles.bodyMuted}>client@domeniu.ro</Text>
          </View>
          <View style={styles.cardPlain}><Text style={styles.bodyText}>Istoric comenzi</Text></View>
          <View style={styles.cardPlain}><Text style={styles.bodyText}>Adrese de livrare</Text></View>
          <View style={styles.cardPlain}><Text style={styles.bodyText}>Setări și securitate</Text></View>
        </View>
      );
    }

    return (
      <View style={styles.stackLarge}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Magazin Dacus.ro</Text>
          <Text style={styles.heroTitle}>Scule, echipamente și consumabile livrate rapid</Text>
          <Text style={styles.heroSub}>Experiență de cumpărare optimizată pentru viteză și claritate.</Text>
          <TouchableOpacity style={styles.heroButton} onPress={() => setPage('products')}>
            <Text style={styles.heroButtonText}>Vezi toate produsele</Text>
          </TouchableOpacity>
        </View>

        {catalogError ? <Text style={styles.errorText}>{catalogError}</Text> : null}

        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={() => setPage('categories')}>
            <Text style={styles.quickTitle}>Categorii</Text>
            <Text style={styles.quickSub}>Intrare rapidă în colecții</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => setPage('loyalty')}>
            <Text style={styles.quickTitle}>Fidelitate</Text>
            <Text style={styles.quickSub}>Puncte, nivel, vouchere</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stackSmall}>
          <Text style={styles.sectionLabel}>Categorii populare</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryChip}
                onPress={() => {
                  setSelectedCategoryId(category.id);
                  setPage('products');
                }}
              >
                <Text style={styles.categoryChipText}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.stackSmall}>
          <Text style={styles.sectionLabel}>Top produse</Text>
          {isLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              <Skeleton height={248} width={188} />
              <Skeleton height={248} width={188} />
              <Skeleton height={248} width={188} />
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {products.slice(0, HOME_FEATURED_PRODUCTS_LIMIT).map((product) => (
                <View key={product.id} style={styles.railCardWrap}>
                  <ProductCard product={product} compact onOpen={openProduct} onOpenImage={openImageZoom} onAdd={addToCart} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

          <View style={styles.stackLarge}>
            {sectionsByCategory.map((section) => (
              <View key={section.category.id} style={styles.stackSmall}>
              <View style={styles.sectionHeadRow}>
                <View>
                  <Text style={styles.sectionLabel}>{section.category.name}</Text>
                  <Text style={styles.bodyMuted}>{section.category.description}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategoryId(section.category.id);
                    setPage('products');
                  }}
                >
                  <Text style={styles.seeAll}>Vezi toate</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {section.products.slice(0, HOME_PRODUCTS_PER_SECTION).map((product) => (
                  <View key={product.id} style={styles.railCardWrap}>
                    <ProductCard product={product} compact onOpen={openProduct} onOpenImage={openImageZoom} onAdd={addToCart} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ))}
          {categories.length > HOME_SECTIONS_LIMIT ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('categories')}>
              <Text style={styles.secondaryButtonText}>Vezi toate categoriile</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const navItem = (target: Page, label: string, icon: IconName, activeIcon?: IconName) => {
    const active = target === page || (target === 'categories' && (page === 'products' || page === 'productDetails'));
    return (
      <TouchableOpacity key={target} style={styles.navItem} onPress={() => setPage(target)}>
        <MaterialCommunityIcons
          name={active && activeIcon ? activeIcon : icon}
          size={20}
          style={[styles.navIcon, active && styles.navIconActive]}
        />
        <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.headerWrap}>
        <View style={styles.headerTop}>
          <Image source={dacusLogo} style={styles.logoImage} resizeMode="contain" />
          <TouchableOpacity style={styles.cartButton} onPress={() => setPage('cart')}>
            <MaterialCommunityIcons name="basket" size={16} color="#FFFFFF" />
            <Text style={styles.cartButtonText}>COȘ {cartCount}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Caută produse, branduri, cod, SKU"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onScroll={onScrollMain}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        {renderPage()}
        <Text style={styles.meta}>API: {mobileEnv.apiBaseUrl}</Text>
        <Text style={styles.meta}>{catalogMeta}</Text>
      </ScrollView>

      {cartCount > 0 && page !== 'cart' ? (
        <TouchableOpacity style={styles.floatingCart} onPress={() => setPage('cart')} activeOpacity={0.93}>
          <View>
            <Text style={styles.floatingCartTitle}>Ai {cartCount} produse în coș</Text>
            <Text style={styles.floatingCartSub}>{formatPrice(cartTotal)}</Text>
          </View>
          <View style={styles.floatingCartActionWrap}>
            <MaterialCommunityIcons name="cart-check" size={16} color={colors.brandAmber} />
            <Text style={styles.floatingCartAction}>Vezi coș</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <Modal visible={!!zoomImageUrl} transparent animationType="fade" onRequestClose={closeImageZoom}>
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={[styles.zoomClose, { top: zoomCloseTop }]} onPress={closeImageZoom}>
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.zoomFrame}>
            {zoomImageUrl ? (
              <Image
                source={{ uri: zoomImageUrl }}
                style={[
                  styles.zoomImage,
                  {
                    width: viewport.width * 0.9,
                    height: viewport.height * 0.65,
                    transform: [{ scale: zoomLevel }],
                  },
                ]}
                resizeMode="contain"
              />
            ) : null}
          </View>

          <View style={styles.zoomActions}>
            <TouchableOpacity
              style={styles.zoomActionButton}
              onPress={() => setZoomLevel((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
            >
              <Text style={styles.zoomActionText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.zoomLevelText}>{Math.round(zoomLevel * 100)}%</Text>
            <TouchableOpacity
              style={styles.zoomActionButton}
              onPress={() => setZoomLevel((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
            >
              <Text style={styles.zoomActionText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showBackTop ? (
        <TouchableOpacity style={styles.backTopButton} onPress={backToTop} activeOpacity={0.9}>
          <MaterialCommunityIcons name="arrow-up" size={18} style={styles.backTopButtonText} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.bottomNav}>
        {navConfig.map((item) => navItem(item.target, item.label, item.icon, item.activeIcon))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImage: { width: 88, height: 30 },
  searchInput: {
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  cartButton: {
    height: 34,
    minWidth: 78,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandRed,
  },
  cartButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  scroll: { flex: 1, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 128 },
  stackLarge: { gap: spacing.md },
  stackSmall: { gap: spacing.xs },
  pageHeading: { fontSize: typography.h2, fontWeight: '800', color: colors.textPrimary },
  sectionLabel: { fontSize: typography.h3, fontWeight: '700', color: colors.textPrimary },
  bodyText: { fontSize: typography.body, color: colors.textPrimary },
  bodyMuted: { fontSize: typography.body, color: colors.textSecondary },
  emptyText: { color: colors.textSecondary, fontSize: typography.body },
  errorText: { color: colors.brandRed, fontSize: typography.caption },
  quickGrid: { flexDirection: 'row', gap: spacing.md },
  quickCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  quickTitle: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '800' },
  quickSub: { fontSize: typography.caption, color: colors.textSecondary },

  heroCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceDark,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroEyebrow: {
    color: colors.brandAmber,
    fontSize: typography.caption,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTitle: { color: colors.textInverted, fontSize: typography.h1, fontWeight: '900', lineHeight: 30 },
  heroSub: { color: '#CDD2DA', fontSize: typography.body, lineHeight: 20 },
  heroButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.brandRed,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.caption },

  categoryChip: {
    backgroundColor: '#ECEFF4',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChipText: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: '700' },
  chipRow: { gap: spacing.sm, paddingRight: spacing.md },
  rail: { gap: spacing.sm, paddingRight: spacing.md },
  railCardWrap: { width: 196 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  seeAll: { color: colors.info, fontSize: typography.caption, fontWeight: '800' },

  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryContent: { flex: 1, gap: spacing.xxs },
  categoryTitle: { fontSize: typography.h3, fontWeight: '800', color: colors.textPrimary },
  categoryDescription: { fontSize: typography.body, color: colors.textSecondary },
  categoryMeta: { fontSize: typography.micro, color: colors.textSecondary, marginTop: spacing.xs },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  categoryThumb: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: colors.surfaceSoft },
  categoryArrow: { fontSize: typography.h1, color: colors.textSecondary, marginLeft: spacing.md },

  filterChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#ECEFF4',
  },
  filterChipActive: { backgroundColor: colors.brandRed },
  filterChipText: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterPanel: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  filterHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterTitle: { fontSize: typography.body, color: colors.textPrimary, fontWeight: '800' },
  resetFilterButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#F5B7BC',
    backgroundColor: '#FFF2F3',
  },
  resetFilterText: { color: colors.brandRed, fontSize: typography.caption, fontWeight: '800' },
  filterLabel: { fontSize: typography.caption, color: colors.textSecondary, fontWeight: '700' },
  filterChipRow: { gap: spacing.xs, paddingRight: spacing.sm },
  filterPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterPillActive: { backgroundColor: colors.brandRed, borderColor: colors.brandRed },
  filterPillText: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700' },
  filterPillTextActive: { color: '#FFFFFF' },
  toggleRow: { flexDirection: 'row', gap: spacing.xs },
  toggleChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  toggleChipActive: { borderColor: colors.brandRed, backgroundColor: '#FFF2F3' },
  toggleChipText: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700' },
  toggleChipTextActive: { color: colors.brandRed },
  filterSummary: { fontSize: typography.micro, color: colors.textSecondary },

  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  gridListContent: { gap: spacing.sm },
  gridRow: { justifyContent: 'space-between' },
  gridCell: { width: '48.4%' },

  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productCardCompact: {
    minHeight: 258,
  },
  productCardTapArea: { flex: 1 },
  productMediaWrap: { width: '100%', backgroundColor: '#FAFBFC' },
  productMedia: {
    width: '100%',
    height: 124,
    backgroundColor: colors.surfaceSoft,
  },
  productMediaCompact: {
    height: 118,
  },
  productCardBody: {
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.brandRed,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  discountBadgeText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900' },

  priceBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },

  addButton: {
    backgroundColor: colors.brandRed,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xxs,
    borderRadius: radii.md,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.caption },

  productThumbSmall: { width: 62, height: 62, borderRadius: radii.md, backgroundColor: colors.surfaceSoft },
  productInfo: { flex: 1, gap: spacing.xxs },
  productName: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700', lineHeight: 17 },
  productBrand: { fontSize: typography.micro, color: colors.textSecondary, fontWeight: '700' },
  productSku: { fontSize: typography.micro, color: colors.textSecondary },
  productPrice: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '900' },
  productOldPrice: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stockPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    backgroundColor: '#E8F5EE',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  stockPillDetails: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: '#E8F5EE',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  stockPillText: { color: colors.success, fontSize: typography.micro, fontWeight: '800' },

  detailsHeroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailsMedia: { height: 286, backgroundColor: colors.surfaceSoft, width: '100%' },
  detailsTitle: { fontSize: typography.h2, fontWeight: '800', color: colors.textPrimary },
  detailsSub: { fontSize: typography.body, color: colors.textSecondary },
  detailsDescription: { fontSize: typography.body, color: colors.textPrimary, lineHeight: 20 },
  detailsPriceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailsPrice: { fontSize: typography.h1, color: colors.brandBlack, fontWeight: '900' },
  detailsOldPrice: { fontSize: typography.body, color: colors.textSecondary, textDecorationLine: 'line-through' },
  detailsActions: { gap: spacing.sm },
  primaryButton: {
    backgroundColor: colors.brandRed,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '800' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brandRed,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: { color: colors.brandRed, fontSize: typography.body, fontWeight: '800' },

  benefitRow: { flexDirection: 'row', gap: spacing.sm },
  benefitCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: '#F3F7FB',
    borderWidth: 1,
    borderColor: '#DEEAF8',
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  benefitTitle: { fontSize: typography.caption, fontWeight: '800', color: colors.info },
  benefitText: { fontSize: typography.caption, color: colors.textSecondary, lineHeight: 16 },

  cartRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  qtyText: { color: colors.brandBlack, fontWeight: '800', fontSize: typography.body },
  qtyValue: { minWidth: 20, textAlign: 'center', color: colors.textPrimary, fontWeight: '700' },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  totalLabel: { color: colors.textSecondary, fontSize: typography.body },
  totalValue: { color: colors.brandBlack, fontWeight: '900', fontSize: typography.h2 },

  loyaltyHero: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loyaltyHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyTierTag: {
    color: colors.brandAmber,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  loyaltyTitle: { color: '#FFFFFF', fontSize: typography.h3, fontWeight: '700' },
  loyaltyPoints: { color: '#FFFFFF', fontSize: typography.h1, fontWeight: '900' },
  loyaltyMeta: { color: '#D1D5DB', fontSize: typography.caption },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: '#2D3138',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brandAmber,
  },

  loyaltyStatRow: { flexDirection: 'row', gap: spacing.sm },
  loyaltyStatCard: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  loyaltyStatLabel: { fontSize: typography.caption, color: colors.textSecondary },
  loyaltyStatValue: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '900' },

  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  tierName: { fontSize: typography.body, color: colors.textPrimary, fontWeight: '700' },
  tierNameActive: { color: colors.brandRed },
  tierRange: { fontSize: typography.caption, color: colors.textSecondary },

  cardPlain: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  skeleton: {
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.skeletonShine,
  },
  bottomNav: {
    height: 62,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { color: colors.textSecondary, marginBottom: 2 },
  navIconActive: { color: colors.brandRed },
  navText: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: '700' },
  navTextActive: { color: colors.brandRed },
  meta: { textAlign: 'center', fontSize: typography.caption, color: colors.textSecondary },

  floatingCart: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.brandRed,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingCartTitle: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  floatingCartSub: { color: '#FDE3E5', fontSize: typography.caption },
  floatingCartActionWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  floatingCartAction: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },

  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 14, 20, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  zoomClose: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomFrame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  zoomImage: { maxWidth: '100%' },
  zoomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  zoomActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomActionText: { color: colors.brandRed, fontSize: typography.h2, fontWeight: '800' },
  zoomLevelText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800', minWidth: 44, textAlign: 'center' },

  backTopButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 146,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backTopButtonText: { color: colors.brandBlack },
});


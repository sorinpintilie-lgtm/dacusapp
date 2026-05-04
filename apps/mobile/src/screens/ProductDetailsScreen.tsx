import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';

import type { CatalogProduct } from '../data/catalog';
import { ProductCard } from '../components/ProductCard';
import { Skeleton } from '../components/Skeleton';
import { colors } from '../theme/tokens';
import { formatPrice, getStockBadgeTone } from '../utils/catalogFilters';
import { fixRomanianMojibake } from '../utils/string';
import type { ScreenStyles } from './screenTypes';

type ProductDetailsScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  selectedProduct?: CatalogProduct;
  selectedVariantId: string;
  wishlist: Set<string>;
  similarProducts: CatalogProduct[];
  upsellProducts: CatalogProduct[];
  bundleProducts: CatalogProduct[];
  backInStockActive: boolean;
  hasImageUrl: (value: string | undefined) => value is string;
  onBack: () => void;
  onOpenImageZoom: (url: string | undefined) => void;
  onSetVariant: (variantId: string) => void;
  onAddToCart: (productId: string) => void;
  onToggleWishlist: (productId: string) => void;
  onToggleBackInStock: (productId: string) => void;
  onAddBundleToCart: (productIds: string[]) => void;
  onOpenProduct: (productId: string) => void;
};

export const ProductDetailsScreen = ({
  styles,
  isLoading,
  selectedProduct,
  selectedVariantId,
  wishlist,
  similarProducts,
  upsellProducts,
  bundleProducts,
  backInStockActive,
  hasImageUrl,
  onBack,
  onOpenImageZoom,
  onSetVariant,
  onAddToCart,
  onToggleWishlist,
  onToggleBackInStock,
  onAddBundleToCart,
  onOpenProduct,
}: ProductDetailsScreenProps) =>
  isLoading ? (
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
      <TouchableOpacity style={styles.detailsBackButton} activeOpacity={0.86} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={colors.brandBlack} />
        <Text style={styles.detailsBackButtonText}>Înapoi la catalog</Text>
      </TouchableOpacity>

      <View style={styles.detailsShowcaseCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            onOpenImageZoom(selectedProduct?.imageUrl ?? selectedProduct?.thumbnailUrl)
          }
        >
          {hasImageUrl(selectedProduct?.imageUrl ?? selectedProduct?.thumbnailUrl) ? (
            <Image
              source={{ uri: selectedProduct?.imageUrl ?? selectedProduct?.thumbnailUrl }}
              style={styles.detailsMedia}
              resizeMode="contain"
              contentFit="contain"
              transition={200}
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            />
          ) : (
            <View style={styles.detailsMediaFallback}>
              <Text style={styles.detailsMediaFallbackText}>Imagine indisponibilă</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.detailsHint}>Atinge imaginea produsului pentru a o mări.</Text>
      </View>

      <View style={styles.detailsPurchaseCard}>
        <View style={styles.detailsShowcaseTop}>
          <Text style={styles.detailsTitle}>
            {fixRomanianMojibake(selectedProduct?.name || '')}
          </Text>
          <View
            style={[
              styles.detailsStockBadge,
              getStockBadgeTone(selectedProduct?.stockLabel) === 'inStock' &&
                styles.stockPillInStock,
              getStockBadgeTone(selectedProduct?.stockLabel) === 'limited' &&
                styles.stockPillLimited,
              getStockBadgeTone(selectedProduct?.stockLabel) === 'outOfStock' &&
                styles.stockPillOutOfStock,
            ]}
          >
            <Text
              style={[
                styles.stockPillText,
                getStockBadgeTone(selectedProduct?.stockLabel) === 'inStock' &&
                  styles.stockPillTextInStock,
                getStockBadgeTone(selectedProduct?.stockLabel) === 'limited' &&
                  styles.stockPillTextLimited,
                getStockBadgeTone(selectedProduct?.stockLabel) === 'outOfStock' &&
                  styles.stockPillTextOutOfStock,
              ]}
            >
              {fixRomanianMojibake(selectedProduct?.stockLabel || '')}
            </Text>
          </View>
        </View>

        <Text style={styles.detailsSub}>{fixRomanianMojibake(selectedProduct?.brand || '')}</Text>

        <View style={styles.detailsPriceRow}>
          <Text style={styles.detailsPrice}>{formatPrice(selectedProduct?.priceRon)}</Text>
          {typeof selectedProduct?.oldPriceRon === 'number' &&
          selectedProduct.oldPriceRon > selectedProduct.priceRon ? (
            <Text style={styles.detailsOldPrice}>{formatPrice(selectedProduct.oldPriceRon)}</Text>
          ) : null}
        </View>

        {selectedProduct?.variants?.length ? (
          <View style={styles.stackSmall}>
            <Text style={styles.filterLabel}>Alege varianta</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipRow}
            >
              {selectedProduct.variants.map((variant) => {
                const active = variant.id === selectedVariantId;
                return (
                  <TouchableOpacity
                    key={variant.id}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => onSetVariant(variant.id)}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {fixRomanianMojibake(variant.name || '')} · {formatPrice(variant.priceRon)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.detailsMetaRow}>
          {selectedProduct?.sku ? (
            <Text style={styles.detailsMetaPill}>SKU: {selectedProduct.sku}</Text>
          ) : null}
          {selectedProduct?.handle ? (
            <Text style={styles.detailsMetaPill}>Cod: {selectedProduct.handle}</Text>
          ) : null}
        </View>

        <View style={styles.detailsActions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onAddToCart(selectedProduct?.id ?? '')}
          >
            <Text style={styles.primaryButtonText}>Adaugă în coș</Text>
          </TouchableOpacity>
          <View style={styles.detailsSecondaryActionsRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                if (selectedProduct?.id) onToggleWishlist(selectedProduct.id);
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {selectedProduct?.id && wishlist.has(selectedProduct.id)
                  ? 'Elimină din favorite'
                  : 'Adaugă la favorite'}
              </Text>
            </TouchableOpacity>
            {selectedProduct?.id ? (
              <TouchableOpacity
                style={styles.detailsBackInStockButton}
                onPress={() => onToggleBackInStock(selectedProduct.id)}
              >
                <Text style={styles.detailsBackInStockButtonText}>
                  {backInStockActive ? 'Alertă stoc activă' : 'Alertă când revine'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {bundleProducts.length > 0 ? (
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <View>
              <Text style={styles.sectionLabel}>Bundle recomandat</Text>
              <Text style={styles.bodyMuted}>Pachet util care completează produsul curent.</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {bundleProducts.map((product) => (
              <View key={product.id} style={styles.railCardWrap}>
                <ProductCard product={product} compact onOpen={onOpenProduct} onAdd={onAddToCart} />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onAddBundleToCart(bundleProducts.map((item) => item.id))}
          >
            <Text style={styles.primaryButtonText}>Adaugă tot bundle-ul</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.detailsHighlightsRow}>
        <View style={styles.detailsHighlightCard}>
          <Text style={styles.detailsHighlightTitle}>Livrare rapidă</Text>
          <Text style={styles.detailsHighlightText}>
            Curier 24-48h în majoritatea localităților.
          </Text>
        </View>
        <View style={styles.detailsHighlightCard}>
          <Text style={styles.detailsHighlightTitle}>Retur simplu</Text>
          <Text style={styles.detailsHighlightText}>
            14 zile pentru retur conform politicii Dacus.
          </Text>
        </View>
      </View>

      <View style={styles.cardPlain}>
        <Text style={styles.sectionLabel}>Descriere</Text>
        <Text style={styles.detailsDescription}>
          {selectedProduct?.description || 'Informații indisponibile momentan.'}
        </Text>
      </View>

      {similarProducts.length > 0 ? (
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <View>
              <Text style={styles.sectionLabel}>Produse similare</Text>
              <Text style={styles.bodyMuted}>Articole apropiate ca tip și preț.</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {similarProducts.map((product) => (
              <View key={product.id} style={styles.railCardWrap}>
                <ProductCard product={product} compact onOpen={onOpenProduct} onAdd={onAddToCart} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {upsellProducts.length > 0 ? (
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <View>
              <Text style={styles.sectionLabel}>Îți recomandăm și</Text>
              <Text style={styles.bodyMuted}>Opțiuni complementare și upgrade-uri utile.</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {upsellProducts.map((product) => (
              <View key={product.id} style={styles.railCardWrap}>
                <ProductCard product={product} compact onOpen={onOpenProduct} onAdd={onAddToCart} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.detailsSpecCard}>
        <Text style={styles.sectionLabel}>Specificații rapide</Text>
        <View style={styles.detailsSpecRow}>
          <Text style={styles.detailsSpecLabel}>Brand</Text>
          <Text style={styles.detailsSpecValue}>
            {fixRomanianMojibake(selectedProduct?.brand || '') || 'Dacus'}
          </Text>
        </View>
        <View style={styles.detailsSpecRow}>
          <Text style={styles.detailsSpecLabel}>SKU</Text>
          <Text style={styles.detailsSpecValue}>
            {selectedProduct?.sku || selectedProduct?.handle || 'N/A'}
          </Text>
        </View>
        <View style={styles.detailsSpecRow}>
          <Text style={styles.detailsSpecLabel}>Disponibilitate</Text>
          <Text style={styles.detailsSpecValue}>{selectedProduct?.stockLabel || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );

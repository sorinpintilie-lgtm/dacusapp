import { Image, Text, TouchableOpacity, View } from 'react-native';

import type { CatalogProduct } from '../data/catalog';
import { AnimatedEntrance } from '../components/UXComponents';
import { EmptyCartState } from '../components/EmptyStates';
import { InlineError } from '../components/ErrorHandling';
import { Skeleton } from '../components/Skeleton';
import type { Address, CartLine } from '../services/commerce';
import { formatPrice } from '../utils/catalogFilters';
import type { ScreenStyles } from './screenTypes';

type CartItem = CartLine & {
  product: CatalogProduct;
  unitPriceRon: number;
  variantName?: string;
  stockRiskLabel?: string;
};

type CartScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  cartItems: CartItem[];
  cartTotal: number;
  cartError: string | null;
  selectedAddress: Address | null;
  addressesCount: number;
  addressBusy: boolean;
  checkoutBusy: boolean;
  deliveryEtaLabel: string;
  priceChangeExplanation: string | null;
  onChangeQuantity: (productId: string, variantId: string | undefined, delta: number) => void;
  onRemoveLine: (productId: string, variantId: string | undefined) => void;
  onCheckout: () => void;
  onOpenProducts: () => void;
  onSelectOrAddAddress: () => void;
  hasImageUrl: (value: string | undefined) => value is string;
};

export const CartScreen = ({
  styles,
  isLoading,
  cartItems,
  cartTotal,
  cartError,
  selectedAddress,
  addressesCount,
  addressBusy,
  checkoutBusy,
  deliveryEtaLabel,
  priceChangeExplanation,
  onChangeQuantity,
  onRemoveLine,
  onCheckout,
  onOpenProducts,
  onSelectOrAddAddress,
  hasImageUrl,
}: CartScreenProps) => {
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={styles.stackLarge}>
      <Text style={styles.pageHeading}>Coșul tău</Text>
      {cartError ? <InlineError message={cartError} /> : null}

      <AnimatedEntrance>
        <View style={styles.cartCheckoutCard}>
          <Text style={styles.sectionLabel}>Finalizează comanda</Text>
          <Text style={styles.bodyMuted}>{cartCount} produse în coș</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total de plată</Text>
            <Text style={styles.totalValue}>{formatPrice(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.92}
            onPress={onCheckout}
            disabled={checkoutBusy}
          >
            <Text style={styles.primaryButtonText}>
              {checkoutBusy ? 'Se validează coșul...' : 'Finalizează comanda'}
            </Text>
          </TouchableOpacity>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={40}>
        <View style={styles.cardPlain}>
          <Text style={styles.sectionLabel}>Adresă de livrare</Text>
          <Text style={styles.bodyMuted}>{deliveryEtaLabel}</Text>
          {selectedAddress ? (
            <>
              <Text style={styles.bodyText}>{selectedAddress.label}</Text>
              <Text style={styles.bodyMuted}>
                {selectedAddress.fullName} · {selectedAddress.phone}
              </Text>
              <Text style={styles.bodyMuted}>
                {selectedAddress.line1}
                {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, {selectedAddress.city},{' '}
                {selectedAddress.county}, {selectedAddress.postalCode},{' '}
                {selectedAddress.countryCode}
              </Text>
            </>
          ) : (
            <Text style={styles.bodyMuted}>Nu există adresă selectată pentru livrare.</Text>
          )}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSelectOrAddAddress}
            disabled={addressBusy}
          >
            <Text style={styles.secondaryButtonText}>
              {addressBusy
                ? 'Se actualizează...'
                : addressesCount > 0
                  ? 'Schimbă adresa de livrare'
                  : 'Adaugă adresa de livrare'}
            </Text>
          </TouchableOpacity>

          {priceChangeExplanation ? (
            <Text style={styles.bodyMuted}>{priceChangeExplanation}</Text>
          ) : null}
        </View>
      </AnimatedEntrance>

      {isLoading ? (
        <>
          <Skeleton height={90} />
          <Skeleton height={90} />
        </>
      ) : cartItems.length === 0 ? (
        <EmptyCartState onBrowseProducts={onOpenProducts} />
      ) : (
        <>
          {cartItems.map((line, index) => (
            <AnimatedEntrance
              key={`${line.productId}-${line.variantId ?? 'default'}`}
              delay={Math.min(220, index * 45)}
            >
              <View style={styles.cartRow}>
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
                  {line.variantName ? (
                    <Text style={styles.productSku}>{line.variantName}</Text>
                  ) : null}
                  <Text style={styles.productPrice}>{formatPrice(line.unitPriceRon)}</Text>
                  <Text style={styles.bodyMuted}>
                    Subtotal: {formatPrice(line.unitPriceRon * line.quantity)}
                  </Text>
                  {line.stockRiskLabel ? (
                    <Text style={styles.productSku}>{line.stockRiskLabel}</Text>
                  ) : null}
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => onChangeQuantity(line.productId, line.variantId, -1)}
                    >
                      <Text style={styles.qtyText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => onChangeQuantity(line.productId, line.variantId, 1)}
                    >
                      <Text style={styles.qtyText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.qtyRemoveButton}
                      onPress={() => onRemoveLine(line.productId, line.variantId)}
                    >
                      <Text style={styles.qtyRemoveText}>Elimină</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </AnimatedEntrance>
          ))}
        </>
      )}
    </View>
  );
};

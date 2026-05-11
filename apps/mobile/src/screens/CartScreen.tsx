import { Ionicons } from '@expo/vector-icons';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import { InlineError } from '../components/ErrorHandling';
import { EmptyCartState } from '../components/EmptyStates';
import { Skeleton } from '../components/Skeleton';
import { AnimatedEntrance } from '../components/UXComponents';
import type { CatalogProduct } from '../data/catalog';
import type { Address, CartLine } from '../services/commerce';
import { colors, spacing } from '../theme/tokens';
import { formatPrice } from '../utils/catalogFilters';
import { fixRomanianMojibake } from '../utils/string';
import type { ScreenStyles } from './screenTypes';

const hasImageUrl = (value: string | undefined): value is string =>
  !!value && /^https?:\/\//.test(value);

type CartItem = CartLine & {
  product: CatalogProduct;
  unitPriceRon: number;
  variantName?: string;
  stockRiskLabel?: string;
};

type CheckoutAddressDraft = Pick<
  Address,
  'label' | 'fullName' | 'phone' | 'line1' | 'line2' | 'city' | 'county' | 'postalCode' | 'countryCode'
>;

type CartScreenProps = {
  styles: ScreenStyles;
  cartItems: CartItem[];
  cartTotal: number;
  cartError: string | null;
  checkoutBusy: boolean;
  deliveryEtaLabel: string;
  priceChangeExplanation: string | null;
  onChangeQuantity: (productId: string, variantId: string | undefined, delta: number) => void;
  onRemoveLine: (productId: string, variantId: string | undefined) => void;
  onCheckout: () => void;
  onOpenProducts: () => void;
};

export const CartScreen = ({
  styles,
  cartItems,
  cartTotal,
  cartError,
  checkoutBusy,
  deliveryEtaLabel,
  priceChangeExplanation,
  onChangeQuantity,
  onRemoveLine,
  onCheckout,
  onOpenProducts,
}: CartScreenProps) => {
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={styles.stackLarge}>
      <Text style={styles.pageHeading}>Coșul tău</Text>
      {cartError ? <InlineError message={cartError} /> : null}

      <AnimatedEntrance>
        <View style={styles.cartCheckoutCard}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="cart-outline" size={18} color={colors.brandRed} />
            <Text style={styles.sectionLabel}>Finalizează comanda</Text>
          </View>
          <Text style={styles.bodyMuted}>{cartCount} produse în coș</Text>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total de plată</Text>
            <Text style={styles.totalValue}>{formatPrice(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
            ]}
            activeOpacity={0.92}
            onPress={onCheckout}
            disabled={checkoutBusy}
          >
            <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {checkoutBusy ? 'Se validează coșul...' : 'Continuă la plată'}
            </Text>
          </TouchableOpacity>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={40}>
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="cube-outline" size={18} color={colors.brandBlue} />
            <Text style={styles.sectionLabel}>Livrare și plată</Text>
          </View>
          <Text style={styles.bodyMuted}>{deliveryEtaLabel}</Text>
          <Text style={styles.bodyMuted}>
            Adresa și datele de plată sunt colectate securizat de Shopify.
          </Text>
          {priceChangeExplanation ? (
            <Text style={styles.bodyMuted}>{priceChangeExplanation}</Text>
          ) : null}
          {/* Trust signals */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
            {[
              { icon: 'shield-checkmark-outline' as const, label: 'Plată securizată' },
              { icon: 'refresh-outline' as const, label: 'Retur 14 zile' },
              { icon: 'headset-outline' as const, label: 'Suport Dacus' },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 99,
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 4,
                }}
              >
                <Ionicons name={item.icon} size={12} color={colors.success} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </AnimatedEntrance>

      {cartItems.length === 0 ? (
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
                    {fixRomanianMojibake(line.product.name)}
                  </Text>
                  {line.variantName ? (
                    <Text style={styles.productSku}>{fixRomanianMojibake(line.variantName)}</Text>
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
                      <Ionicons name="remove" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => onChangeQuantity(line.productId, line.variantId, 1)}
                    >
                      <Ionicons name="add" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.qtyRemoveButton}
                      onPress={() => onRemoveLine(line.productId, line.variantId)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.brandRed} />
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

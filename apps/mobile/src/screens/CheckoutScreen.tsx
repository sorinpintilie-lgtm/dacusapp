import { ActivityIndicator, Image, Text, TouchableOpacity, View, Linking } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import type { ScreenStyles } from './screenTypes';
import type { CartLine, Address, AddressDraft } from '../services/commerce';
import type { CatalogProduct } from '../data/catalog';
import { colors, spacing } from '../theme/tokens';
import { formatPrice } from '../utils/catalogFilters';
import { fixRomanianMojibake } from '../utils/string';
import { AnimatedEntrance } from '../components/UXComponents';

type CheckoutCartItem = CartLine & {
  product: CatalogProduct;
  unitPriceRon: number;
  variantName?: string;
};

type CheckoutScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  isProcessing: boolean;
  cartItems: CheckoutCartItem[];
  cartTotal: number;
  selectedAddress: Address | null;
  addressDraft: AddressDraft | null;
  onGoBack: () => void;
  onConfirmCheckout: () => void;
  onOpenExternalCheckout: (url: string) => void;
};

export const CheckoutScreen = ({
  styles,
  isLoading,
  isProcessing,
  cartItems,
  cartTotal,
  selectedAddress,
  addressDraft,
  onGoBack,
  onConfirmCheckout,
  onOpenExternalCheckout,
}: CheckoutScreenProps) => {
  const shippingAddress = selectedAddress ?? addressDraft;
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <View style={styles.stackLarge}>
        <Text style={styles.pageHeading}>Se pregătește comanda...</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.bodyMuted}>Te rugăm să aștepți.</Text>
        </View>
      </View>
    );
  }

  if (isProcessing) {
    return (
      <View style={styles.stackLarge}>
        <Text style={styles.pageHeading}>Se procesează comanda...</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.bodyMuted}>Solicităm checkout-ul de la magazin.</Text>
          <Text style={styles.bodyMuted}>Te rugăm să aștepți câteva momente.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
        <Ionicons name="arrow-back" size={20} color={colors.brandBlack} />
        <Text style={styles.backButtonText}>Înapoi</Text>
      </TouchableOpacity>

      <Text style={styles.pageHeading}>Finalizează comanda</Text>

      <AnimatedEntrance>
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="receipt-outline" size={18} color={colors.brandRed} />
            <Text style={styles.sectionLabel}>Rezumat comandă</Text>
          </View>
          <Text style={styles.bodyMuted}>{itemCount} produse</Text>
          <Text style={styles.totalValue}>{formatPrice(cartTotal)}</Text>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={40}>
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="cube-outline" size={18} color={colors.brandBlue} />
            <Text style={styles.sectionLabel}>Produse</Text>
          </View>
          {cartItems.map((item, index) => (
            <View key={`${item.productId}-${item.variantId ?? 'default'}`} style={styles.cartRow}>
              {item.product?.thumbnailUrl || item.product?.imageUrl ? (
                <Image
                  source={{ uri: item.product.thumbnailUrl ?? item.product.imageUrl }}
                  style={styles.productThumbSmall}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.productThumbSmall} />
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {fixRomanianMojibake(item.product?.name) ?? 'Produs'}
                </Text>
                {item.variantName ? (
                  <Text style={styles.productSku}>{fixRomanianMojibake(item.variantName)}</Text>
                ) : null}
                <Text style={styles.bodyMuted}>
                  {item.quantity} x {formatPrice(item.unitPriceRon)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={80}>
        <View style={styles.cardPlain}>
          <View style={styles.sectionHeadRow}>
            <Ionicons name="location-outline" size={18} color={colors.brandBlue} />
            <Text style={styles.sectionLabel}>Livrare și plată</Text>
          </View>
          <Text style={styles.bodyMuted}>
            Adresa de livrare și informațiile de plată vor fi colectate de către Shopify pentru finalizarea comenzii.
          </Text>
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance delay={120}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total de plată</Text>
          <Text style={styles.totalValueLarge}>{formatPrice(cartTotal)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
          ]}
          activeOpacity={0.92}
          onPress={onConfirmCheckout}
        >
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Continuă la plată</Text>
        </TouchableOpacity>

        <Text style={styles.bodyMuted}>
          Vei fi redirecționat către pagina de plată a magazinului.
        </Text>
      </AnimatedEntrance>
    </View>
  );
};

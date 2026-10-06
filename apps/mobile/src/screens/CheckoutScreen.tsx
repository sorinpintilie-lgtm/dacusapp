import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state/AppProvider';
import { colors, continuous, radii, shadows, spacing } from '../theme/tokens';
import { AppText, Button, Card, EmptyState, ListItem, ListSection, ProductRow } from '../ui';
import { formatPrice } from '../utils/catalogFilters';

export function CheckoutScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    cartItems,
    cartCount,
    cartTotal,
    accountUser,
    addresses,
    selectedAddressId,
    selectAddress,
    addressBusy,
    checkoutBusy,
    checkoutError,
    processCheckout,
  } = useApp();

  if (cartItems.length === 0) {
    return (
      <EmptyState
        icon="bag-check-outline"
        title="Nu ai produse de plătit"
        message="Coșul este gol."
        actionLabel="Înapoi"
        onAction={() => navigation.goBack()}
      />
    );
  }

  const needsAddress = !!accountUser && !selectedAddressId;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 116 + insets.bottom }]}>
        {checkoutError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <AppText variant="subhead" tone="danger" style={styles.flex}>
              {checkoutError}
            </AppText>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="footnote" tone="secondary" style={styles.sectionTitle}>
            Produse ({cartCount})
          </AppText>
          <Card padded={false} style={styles.items}>
            {cartItems.map((item, index) => (
              <View key={`${item.productId}-${item.variantId ?? 'default'}`} style={index > 0 ? styles.divider : null}>
                <ProductRow
                  product={item.product}
                  price={item.unitPriceRon}
                  thumbSize={56}
                  meta={[item.variantName, `Cantitate: ${item.quantity}`].filter(Boolean).join(', ')}
                />
              </View>
            ))}
          </Card>
        </View>

        {accountUser ? (
          <ListSection
            title="Adresa de livrare"
            footer={needsAddress ? 'Adaugă o adresă ca să poți continua spre plată.' : undefined}
          >
            {addresses.map((address) => {
              const selected = address.id === selectedAddressId;
              return (
                <ListItem
                  key={address.id}
                  icon="location-outline"
                  title={address.label}
                  subtitle={`${address.fullName}, ${address.line1}${address.line2 ? `, ${address.line2}` : ''}, ${address.city}`}
                  disabled={addressBusy}
                  selected={selected}
                  onPress={() => selectAddress(address.id)}
                  accessory={
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? colors.brand : colors.lineStrong}
                    />
                  }
                />
              );
            })}
            <ListItem icon="add" title="Adaugă o adresă nouă" onPress={() => navigation.navigate('AddressEditor')} />
          </ListSection>
        ) : (
          <Card>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={colors.textPrimary} />
              <AppText variant="body" style={styles.flex}>
                Adresa de livrare o completezi în pagina de plată.
              </AppText>
            </View>
            <Button
              title="Intră în cont pentru comenzi mai rapide"
              variant="secondary"
              size="sm"
              onPress={() => navigation.navigate('Login')}
            />
          </Card>
        )}

        <Card>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textPrimary} />
            <AppText variant="body" style={styles.flex}>
              Plata se face în pagina securizată a magazinului. Primești confirmarea pe email.
            </AppText>
          </View>
        </Card>

        <Card>
          <View style={styles.totalRow}>
            <AppText variant="body">Produse</AppText>
            <AppText variant="bodyMedium">{formatPrice(cartTotal)}</AppText>
          </View>
          <View style={styles.totalRow}>
            <AppText variant="body" tone="secondary">
              Livrare
            </AppText>
            <AppText variant="body" tone="secondary">
              Se calculează la plată
            </AppText>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalRow}>
            <AppText variant="headline">Total</AppText>
            <AppText variant="title2">{formatPrice(cartTotal)}</AppText>
          </View>
        </Card>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button
          title={needsAddress ? 'Adaugă o adresă de livrare' : `Plătește ${formatPrice(cartTotal)}`}
          icon={needsAddress ? 'location-outline' : 'lock-closed'}
          size="lg"
          fullWidth
          loading={checkoutBusy}
          onPress={() => (needsAddress ? navigation.navigate('AddressEditor') : void processCheckout())}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.grouped },
  content: { padding: spacing.md, gap: spacing.lg },
  flex: { flex: 1 },
  errorCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerTint,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.md,
  },
  section: { gap: spacing.xs },
  sectionTitle: { paddingHorizontal: spacing.xxs },
  items: { paddingHorizontal: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    ...shadows.bar,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import type { Address } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, continuous, radii, spacing } from '../theme/tokens';
import { AppText, Badge, Button, EmptyState, IconButton, Touchable } from '../ui';

export function AddressesScreen() {
  const navigation = useNavigation();
  const { accountUser, addresses, selectedAddressId, selectAddress, deleteAddress, addressBusy } = useApp();

  if (!accountUser) {
    return (
      <EmptyState
        icon="location-outline"
        title="Intră în cont"
        message="Adresele de livrare se salvează în contul tău."
        actionLabel="Intră în cont"
        onAction={() => navigation.navigate('Login')}
      />
    );
  }

  const confirmDelete = (address: Address) =>
    Alert.alert('Ștergi adresa?', `${address.label} · ${address.line1}, ${address.city}`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => deleteAddress(address.id) },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {addresses.length === 0 ? (
        <EmptyState
          icon="location-outline"
          title="Nicio adresă salvată"
          message="Adaugă o adresă ca să finalizezi comenzile mai repede."
        />
      ) : (
        addresses.map((address) => {
          const isDefault = address.id === selectedAddressId;
          return (
            <View key={address.id} style={[styles.card, isDefault && styles.cardDefault]}>
              <Touchable
                onPress={() => (isDefault ? undefined : selectAddress(address.id))}
                disabled={addressBusy}
                pressedScale={0.99}
                haptic={isDefault ? undefined : 'selection'}
                style={styles.cardMain}
                accessibilityState={{ selected: isDefault }}
                accessibilityLabel={isDefault ? `${address.label}, adresa implicită` : `Setează ${address.label} ca implicită`}
              >
                <View style={styles.cardHeader}>
                  <Ionicons
                    name={isDefault ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isDefault ? colors.brand : colors.textTertiary}
                  />
                  <AppText variant="headline" style={styles.flex} numberOfLines={1}>
                    {address.label}
                  </AppText>
                  {isDefault && <Badge label="Implicită" tone="brandSoft" />}
                </View>
                <View style={styles.lines}>
                  <AppText variant="body">
                    {address.fullName}, {address.phone}
                  </AppText>
                  <AppText variant="subhead" tone="secondary">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ''}
                  </AppText>
                  <AppText variant="subhead" tone="secondary">
                    {address.city}, {address.county}, {address.postalCode}, {address.countryCode}
                  </AppText>
                </View>
              </Touchable>
              <View style={styles.actions}>
                <IconButton
                  icon="create-outline"
                  accessibilityLabel={`Editează ${address.label}`}
                  onPress={() => navigation.navigate('AddressEditor', { addressId: address.id })}
                  size={36}
                />
                <IconButton
                  icon="trash-outline"
                  accessibilityLabel={`Șterge ${address.label}`}
                  onPress={() => confirmDelete(address)}
                  size={36}
                  color={colors.danger}
                  disabled={addressBusy}
                />
              </View>
            </View>
          );
        })
      )}
      <Button title="Adaugă o adresă nouă" icon="add" size="lg" onPress={() => navigation.navigate('AddressEditor')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    ...continuous,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardDefault: { borderColor: colors.brand },
  cardMain: { gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lines: { gap: 2, paddingLeft: 30 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
});

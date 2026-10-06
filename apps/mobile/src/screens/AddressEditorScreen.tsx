import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLayoutEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import type { AddressDraft } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, spacing } from '../theme/tokens';
import { AppText, Button, IconButton, TextField } from '../ui';

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
};

const formatPostalCode = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export function AddressEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddressEditor'>>();
  const insets = useSafeAreaInsets();
  const { accountUser, addresses, saveAddress, addressBusy } = useApp();
  const addressId = route.params?.addressId;
  const existing = addresses.find((address) => address.id === addressId);

  const [draft, setDraft] = useState<AddressDraft>(() => ({
    label: existing?.label ?? '',
    fullName: existing?.fullName ?? accountUser?.name ?? '',
    phone: existing?.phone ?? '',
    line1: existing?.line1 ?? '',
    line2: existing?.line2 ?? '',
    city: existing?.city ?? '',
    county: existing?.county ?? '',
    postalCode: existing?.postalCode ?? '',
    countryCode: existing?.countryCode ?? 'RO',
  }));
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? 'Editează adresa' : 'Adresă nouă',
      headerLeft: () => <IconButton icon="close" accessibilityLabel="Închide" onPress={() => navigation.goBack()} size={36} />,
    });
  }, [existing, navigation]);

  const update = (key: keyof AddressDraft, value: string) => {
    const normalized = key === 'phone' ? formatPhone(value) : key === 'postalCode' ? formatPostalCode(value) : value;
    setDraft((current) => ({ ...current, [key]: normalized }));
    if (error) setError(null);
  };

  const submit = async () => {
    const line2 = draft.line2?.trim() ?? '';
    const next: AddressDraft = {
      label: draft.label.trim(),
      fullName: draft.fullName.trim(),
      phone: draft.phone.trim(),
      line1: draft.line1.trim(),
      city: draft.city.trim(),
      county: draft.county.trim(),
      postalCode: draft.postalCode.trim(),
      countryCode: (draft.countryCode.trim() || 'RO').toUpperCase(),
      ...(line2 ? { line2 } : {}),
    };

    const required = [next.label, next.fullName, next.phone, next.line1, next.city, next.county, next.postalCode, next.countryCode];
    if (required.some((value) => value.length === 0)) {
      setError('Completează toate câmpurile obligatorii (*).');
      return;
    }
    if (next.phone.replace(/\D/g, '').length < 9) {
      setError('Numărul de telefon nu este valid.');
      return;
    }

    try {
      await saveAddress(next, existing?.id);
      navigation.goBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nu am putut salva adresa.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <TextField label="Denumire *" value={draft.label} onChangeText={(value) => update('label', value)} placeholder="Acasă, Birou..." />
        <TextField
          label="Nume complet *"
          value={draft.fullName}
          onChangeText={(value) => update('fullName', value)}
          placeholder="Prenume și nume"
          autoCapitalize="words"
          autoComplete="name"
        />
        <TextField
          label="Telefon *"
          value={draft.phone}
          onChangeText={(value) => update('phone', value)}
          placeholder="07xx xxx xxx"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <TextField
          label="Stradă și număr *"
          value={draft.line1}
          onChangeText={(value) => update('line1', value)}
          placeholder="Strada, numărul"
          autoComplete="street-address"
        />
        <TextField
          label="Bloc, scară, apartament"
          value={draft.line2 ?? ''}
          onChangeText={(value) => update('line2', value)}
          placeholder="Opțional"
        />
        <View style={styles.row}>
          <TextField label="Oraș *" value={draft.city} onChangeText={(value) => update('city', value)} style={styles.half} />
          <TextField label="Județ *" value={draft.county} onChangeText={(value) => update('county', value)} style={styles.half} />
        </View>
        <View style={styles.row}>
          <TextField
            label="Cod poștal *"
            value={draft.postalCode}
            onChangeText={(value) => update('postalCode', value)}
            keyboardType="number-pad"
            autoComplete="postal-code"
            style={styles.half}
          />
          <TextField
            label="Țară *"
            value={draft.countryCode}
            onChangeText={(value) => update('countryCode', value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={2}
            style={styles.half}
          />
        </View>

        {error ? (
          <AppText variant="subhead" tone="danger">
            {error}
          </AppText>
        ) : null}

        <Button title="Salvează adresa" size="lg" fullWidth loading={addressBusy} onPress={() => void submit()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.grouped },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});

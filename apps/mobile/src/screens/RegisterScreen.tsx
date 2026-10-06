import { StackActions, useNavigation } from '@react-navigation/native';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { useApp } from '../state/AppProvider';
import { colors, hitSlop, radii, spacing } from '../theme/tokens';
import { AppText, Button, Chip, IconButton, ListItem, ListSection, TextField, Touchable } from '../ui';

const BRAND_OPTIONS = 10;
const CATEGORY_OPTIONS = 8;

export function RegisterScreen() {
  const navigation = useNavigation();
  const {
    register,
    authBusy,
    authError,
    clearAuthError,
    products,
    featuredCategories,
    preferenceOnboarding,
    toggleOnboardingBrand,
    toggleOnboardingCategory,
    toggleMarketingOptIn,
    trustConsent,
    toggleTrustConsent,
  } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () =>
        step === 2 ? (
          <IconButton icon="chevron-back" accessibilityLabel="Înapoi" onPress={() => setStep(1)} size={36} />
        ) : (
          <IconButton icon="close" accessibilityLabel="Închide" onPress={() => navigation.goBack()} size={36} />
        ),
    });
  }, [navigation, step]);

  const topBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.brand, (counts.get(product.brand) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, BRAND_OPTIONS)
      .map(([brand]) => brand);
  }, [products]);

  const goToPreferences = () => {
    if (name.trim().length < 2) {
      setStepError('Completează numele.');
      return;
    }
    if (!email.trim().includes('@')) {
      setStepError('Introdu o adresă de email validă.');
      return;
    }
    if (password.length < 6) {
      setStepError('Parola trebuie să aibă minimum 6 caractere.');
      return;
    }
    setStepError(null);
    setStep(2);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          <View style={[styles.progressStep, styles.progressStepDone]} />
          <View style={[styles.progressStep, step === 2 && styles.progressStepDone]} />
        </View>
        <AppText variant="caption" tone="secondary">
          Pasul {step} din 2
        </AppText>

        {step === 1 ? (
          <>
            <AppText variant="title1">Creează cont</AppText>
            <AppText variant="body" tone="secondary">
              Salvezi comenzile, strângi puncte și primești oferte potrivite.
            </AppText>
            <TextField
              label="Nume complet"
              value={name}
              onChangeText={setName}
              placeholder="Prenume și nume"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nume@exemplu.ro"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label="Parolă"
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 6 caractere"
              password
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              error={stepError}
            />
            <Button title="Continuă" size="lg" fullWidth onPress={goToPreferences} />
          </>
        ) : (
          <>
            <AppText variant="title1">Ce te interesează?</AppText>
            <AppText variant="body" tone="secondary">
              Opțional. Ne ajută să îți arătăm produse potrivite.
            </AppText>

            <View style={styles.group}>
              <AppText variant="headline">Branduri</AppText>
              <View style={styles.wrap}>
                {topBrands.map((brand) => (
                  <Chip
                    key={brand}
                    label={brand}
                    selected={preferenceOnboarding.favoriteBrands.includes(brand)}
                    onPress={() => toggleOnboardingBrand(brand)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <AppText variant="headline">Categorii</AppText>
              <View style={styles.wrap}>
                {featuredCategories.slice(0, CATEGORY_OPTIONS).map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={preferenceOnboarding.favoriteCategories.includes(category.id)}
                    onPress={() => toggleOnboardingCategory(category.id)}
                  />
                ))}
              </View>
            </View>

            <ListSection title="Acorduri" tone="well">
              <ConsentRow title="Oferte personalizate pe email" value={preferenceOnboarding.marketingOptIn} onChange={toggleMarketingOptIn} />
              <ConsentRow title="Statistici anonime" value={trustConsent.analytics} onChange={() => toggleTrustConsent('analytics')} />
              <ConsentRow
                title="Recomandări personalizate"
                value={trustConsent.personalization}
                onChange={() => toggleTrustConsent('personalization')}
              />
              <ConsentRow title="Comunicări comerciale" value={trustConsent.marketing} onChange={() => toggleTrustConsent('marketing')} />
            </ListSection>

            {authError ? (
              <AppText variant="subhead" tone="danger">
                {authError}
              </AppText>
            ) : null}
            <Button
              title="Creează contul"
              size="lg"
              fullWidth
              loading={authBusy}
              onPress={() => void register(email, password, name)}
            />
          </>
        )}

        <View style={styles.switchRow}>
          <AppText variant="body" tone="secondary">
            Ai deja cont?
          </AppText>
          <Touchable
            onPress={() => navigation.dispatch(StackActions.replace('Login'))}
            hitSlop={hitSlop}
            pressedScale={0.97}
            disabled={authBusy}
          >
            <AppText variant="headline" tone="brand">
              Intră în cont
            </AppText>
          </Touchable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ConsentRow({ title, value, onChange }: { title: string; value: boolean; onChange: () => void }) {
  return (
    <ListItem
      title={title}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: colors.brand, false: colors.lineStrong }}
          thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  progress: { flexDirection: 'row', gap: spacing.xs },
  progressStep: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: colors.well },
  progressStepDone: { backgroundColor: colors.brand },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
});

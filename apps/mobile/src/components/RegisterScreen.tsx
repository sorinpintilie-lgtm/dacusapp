import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';
import { fixRomanianMojibake } from '../utils/string';

type RegisterScreenProps = {
  email: string;
  password: string;
  name: string;
  step: 1 | 2;
  preferenceBrands: string[];
  selectedBrands: string[];
  preferenceCategories: Array<{ id: string; name: string }>;
  selectedCategoryIds: string[];
  marketingOptIn: boolean;
  consentAnalytics: boolean;
  consentPersonalization: boolean;
  consentMarketing: boolean;
  busy: boolean;
  errorMessage: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNextStep: () => void;
  onBackStep: () => void;
  onToggleBrand: (brand: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onToggleMarketingOptIn: () => void;
  onToggleConsent: (key: 'analytics' | 'personalization' | 'marketing') => void;
  onRegister: () => void;
  onGoLogin: () => void;
};

export function RegisterScreen({
  email,
  password,
  name,
  step,
  preferenceBrands,
  selectedBrands,
  preferenceCategories,
  selectedCategoryIds,
  marketingOptIn,
  consentAnalytics,
  consentPersonalization,
  consentMarketing,
  busy,
  errorMessage,
  onEmailChange,
  onPasswordChange,
  onNameChange,
  onNextStep,
  onBackStep,
  onToggleBrand,
  onToggleCategory,
  onToggleMarketingOptIn,
  onToggleConsent,
  onRegister,
  onGoLogin,
}: RegisterScreenProps) {
  return (
    <View style={styles.stackLarge}>
      <View style={styles.cardPlain}>
        <Text style={styles.pageHeading}>Creează cont</Text>
        <Text style={styles.bodyMuted}>
          Deschide un cont nou pentru a salva comenzile și punctele.
        </Text>

        <View style={styles.stackSmall}>
          {step === 1 ? (
            <>
              <TextInput
                style={styles.authInput}
                placeholder="Nume complet"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={onNameChange}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TextInput
                style={styles.authInput}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={onEmailChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <TextInput
                style={styles.authInput}
                placeholder="Parolă"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={onPasswordChange}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : (
            <>
              <Text style={styles.bodyMuted}>Alege brandurile preferate</Text>
              <View style={styles.prefWrap}>
                {preferenceBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand}
                    style={styles.prefChip}
                    onPress={() => onToggleBrand(brand)}
                  >
                    <Text style={styles.prefChipText}>
                      {selectedBrands.includes(brand) ? `☑ ${brand}` : `☐ ${brand}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.bodyMuted}>Alege categoriile preferate</Text>
              <View style={styles.prefWrap}>
                {preferenceCategories.slice(0, 8).map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.prefChip}
                    onPress={() => onToggleCategory(category.id)}
                  >
                    <Text style={styles.prefChipText}>
                      {selectedCategoryIds.includes(category.id)
                        ? `☑ ${fixRomanianMojibake(category.name)}`
                        : `☐ ${fixRomanianMojibake(category.name)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.secondaryButton} onPress={onToggleMarketingOptIn}>
                <Text style={styles.secondaryButtonText}>
                  {marketingOptIn ? '☑' : '☐'} Oferte personalizate prin email
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => onToggleConsent('analytics')}
              >
                <Text style={styles.secondaryButtonText}>
                  {consentAnalytics ? '☑' : '☐'} Consimțământ analytics
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => onToggleConsent('personalization')}
              >
                <Text style={styles.secondaryButtonText}>
                  {consentPersonalization ? '☑' : '☐'} Consimțământ personalizare
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => onToggleConsent('marketing')}
              >
                <Text style={styles.secondaryButtonText}>
                  {consentMarketing ? '☑' : '☐'} Consimțământ marketing
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.stackSmall}>
          {step === 1 ? (
            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.buttonDisabled]}
              onPress={onNextStep}
              disabled={busy}
            >
              <Text style={styles.primaryButtonText}>Continuă</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                onPress={onRegister}
                disabled={busy}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Se procesează...' : 'Creează cont'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onBackStep} disabled={busy}>
                <Text style={styles.secondaryButtonText}>Înapoi</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={onGoLogin} disabled={busy}>
            <Text style={styles.secondaryButtonText}>Ai deja cont? Intră în cont</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stackLarge: { gap: spacing.md },
  stackSmall: { gap: spacing.xs },
  cardPlain: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  pageHeading: { fontSize: typography.h2, fontWeight: '800', color: colors.textPrimary },
  bodyMuted: { fontSize: typography.body, color: colors.textSecondary },
  authInput: {
    height: 44,
    borderRadius: radii.md,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  errorText: { color: colors.brandRed, fontSize: typography.caption, fontWeight: '700' },
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
  buttonDisabled: { opacity: 0.65 },
  prefWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  prefChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  prefChipText: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: '700' },
});

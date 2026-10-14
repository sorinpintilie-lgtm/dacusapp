import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import type { AccountSettingsPatch } from '../services/commerce';
import { useApp } from '../state/AppProvider';
import { colors, continuous, fonts, radii, spacing } from '../theme/tokens';
import { AppText, Button, ListItem, ListSection, useToast } from '../ui';

const SOURCE = 'mobile_app';

type SwitchRowProps = {
  title: string;
  subtitle?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

function SwitchRow({ title, subtitle, value, disabled, onChange }: SwitchRowProps) {
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      right={
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ true: colors.brand, false: colors.lineStrong }}
          thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
        />
      }
    />
  );
}

const PRIVACY_POLICY_URL = 'https://dacus.ro/policies/privacy-policy';
const TERMS_URL = 'https://dacus.ro/policies/terms-of-service';

const DELETE_TITLE = 'Ștergi contul?';
const DELETE_MESSAGE =
  'Contul, adresele, lista de favorite, punctele de fidelitate și setările se șterg definitiv. Comenzile plasate rămân înregistrate la magazin.';

/** Account deletion always asks first (the App Store requires the option; nobody should hit it by accident). */
function confirmDeleteAccount(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${DELETE_TITLE}

${DELETE_MESSAGE}`)) onConfirm();
    return;
  }
  Alert.alert(DELETE_TITLE, DELETE_MESSAGE, [
    { text: 'Renunță', style: 'cancel' },
    { text: 'Șterge contul', style: 'destructive', onPress: onConfirm },
  ]);
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const { show: showToast } = useToast();
  const {
    accountUser,
    effectiveAccountSettings: settings,
    settingsLoading,
    refreshServerAccountSettings,
    updateSettings,
    changePassword,
    biometricLoginEnabled,
    toggleBiometricLogin,
    logout,
    deleteAccount,
  } = useApp();
  const signedIn = !!accountUser;

  const [displayName, setDisplayName] = useState(settings.profile.displayName);
  const [locale, setLocale] = useState(settings.profile.locale);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busySection, setBusySection] = useState<string | null>(null);

  useEffect(() => {
    if (signedIn) void refreshServerAccountSettings();
  }, [refreshServerAccountSettings, signedIn]);

  useEffect(() => {
    setDisplayName(settings.profile.displayName);
    setLocale(settings.profile.locale);
  }, [settings.profile.displayName, settings.profile.locale]);

  const save = async (section: string, patch: AccountSettingsPatch, successMessage: string) => {
    setBusySection(section);
    try {
      await updateSettings(patch);
      showToast(successMessage);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Nu am putut salva setările.', 'error');
    } finally {
      setBusySection(null);
    }
  };

  const saveProfile = () => {
    const nextName = displayName.trim();
    const nextLocale = locale.trim();
    if (nextName.length < 2) {
      showToast('Numele trebuie să aibă cel puțin 2 caractere.', 'error');
      return;
    }
    if (nextLocale.length < 2) {
      showToast('Limba nu este validă. Exemplu: ro-RO.', 'error');
      return;
    }
    void save('profile', { profile: { displayName: nextName, locale: nextLocale } }, 'Profilul a fost actualizat.');
  };

  const submitPasswordChange = async () => {
    const current = currentPassword.trim();
    const next = newPassword.trim();
    if (!current || !next) {
      showToast('Completează parola curentă și parola nouă.', 'error');
      return;
    }
    if (next.length < 8) {
      showToast('Parola nouă trebuie să aibă minimum 8 caractere.', 'error');
      return;
    }
    setBusySection('password');
    try {
      await changePassword(current, next);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Parola a fost schimbată.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Nu am putut schimba parola.', 'error');
    } finally {
      setBusySection(null);
    }
  };

  const marketingGranted = settings.privacy.marketingConsent.granted;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="subhead" tone="secondary" style={styles.intro}>
          {signedIn
            ? `Sincronizate cu contul ${accountUser.email}.`
            : 'Setările se salvează doar pe acest dispozitiv. Intră în cont ca să le sincronizezi.'}
          {settingsLoading ? ' Se actualizează...' : ''}
        </AppText>

        {signedIn ? (
          <ListSection title="Profil">
            <View style={styles.form}>
              <AppText variant="caption" tone="secondary">
                Nume afișat
              </AppText>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nume afișat"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
              />
              <AppText variant="caption" tone="secondary">
                Limbă
              </AppText>
              <TextInput
                style={styles.input}
                value={locale}
                onChangeText={setLocale}
                placeholder="ro-RO"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
              />
              <Button title="Salvează profilul" size="sm" loading={busySection === 'profile'} onPress={saveProfile} />
            </View>
          </ListSection>
        ) : (
          <ListSection>
            <ListItem icon="log-in-outline" iconColor={colors.brand} title="Intră în cont" onPress={() => navigation.navigate('Login')} />
          </ListSection>
        )}

        <ListSection title="Notificări" footer={signedIn ? undefined : 'Disponibile după autentificare.'}>
          <SwitchRow
            title="Emailuri despre comenzi"
            subtitle="Confirmări, livrare și modificări"
            value={settings.notifications.email.orderUpdates}
            disabled={!signedIn || busySection === 'notifications'}
            onChange={(value) =>
              void save('notifications', { notifications: { email: { orderUpdates: value } } }, 'Preferința a fost salvată.')
            }
          />
          <SwitchRow
            title="Alerte de securitate"
            subtitle="Autentificări noi sau suspecte"
            value={settings.notifications.push.securityAlerts}
            disabled={!signedIn || busySection === 'notifications'}
            onChange={(value) =>
              void save('notifications', { notifications: { push: { securityAlerts: value } } }, 'Preferința a fost salvată.')
            }
          />
          <SwitchRow
            title="Produse revenite în stoc"
            subtitle="Pentru produsele pe care le urmărești"
            value={settings.notifications.push.backInStock}
            disabled={!signedIn || busySection === 'notifications'}
            onChange={(value) =>
              void save('notifications', { notifications: { push: { backInStock: value } } }, 'Preferința a fost salvată.')
            }
          />
        </ListSection>

        <ListSection title="Confidențialitate">
          <SwitchRow
            title="Statistici anonime"
            subtitle="Ne ajută să îmbunătățim aplicația"
            value={settings.privacy.analyticsConsent.granted}
            disabled={busySection === 'privacy'}
            onChange={(value) =>
              void save('privacy', { privacy: { analyticsConsent: { granted: value, source: SOURCE } } }, 'Acordul a fost actualizat.')
            }
          />
          <SwitchRow
            title="Recomandări personalizate"
            subtitle="Pe baza produselor văzute"
            value={settings.privacy.personalizationConsent.granted}
            disabled={busySection === 'privacy'}
            onChange={(value) =>
              void save(
                'privacy',
                { privacy: { personalizationConsent: { granted: value, source: SOURCE } } },
                'Acordul a fost actualizat.',
              )
            }
          />
          <SwitchRow
            title="Oferte și noutăți"
            subtitle="Comunicări comerciale pe email și în aplicație"
            value={marketingGranted}
            disabled={busySection === 'privacy'}
            onChange={(value) =>
              void save(
                'privacy',
                {
                  privacy: { marketingConsent: { granted: value, source: SOURCE } },
                  notifications: { email: { marketing: value }, push: { marketing: value }, inApp: { marketing: value } },
                },
                'Acordul a fost actualizat.',
              )
            }
          />
        </ListSection>

        <ListSection title="Securitate">
          <SwitchRow
            title="Autentificare biometrică"
            subtitle="Face ID sau amprentă pe acest dispozitiv"
            value={biometricLoginEnabled}
            onChange={() => void toggleBiometricLogin()}
          />
          {signedIn ? (
            <SwitchRow
              title="Alerte la autentificare"
              value={settings.security.loginAlerts}
              disabled={busySection === 'security'}
              onChange={(value) => void save('security', { security: { loginAlerts: value } }, 'Setarea a fost salvată.')}
            />
          ) : null}
          {signedIn ? (
            <SwitchRow
              title="Autentificare în doi pași"
              value={settings.security.twoFactorEnabled}
              disabled={busySection === 'security'}
              onChange={(value) => void save('security', { security: { twoFactorEnabled: value } }, 'Setarea a fost salvată.')}
            />
          ) : null}
          {signedIn ? (
            <ListItem icon="phone-portrait-outline" title="Sesiuni active" onPress={() => navigation.navigate('DeviceSessions')} />
          ) : null}
        </ListSection>

        {signedIn ? (
          <ListSection title="Schimbă parola">
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Parola curentă"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
              />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Parola nouă (minimum 8 caractere)"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
              />
              <Button
                title="Schimbă parola"
                size="sm"
                variant="secondary"
                loading={busySection === 'password'}
                onPress={() => void submitPasswordChange()}
              />
            </View>
          </ListSection>
        ) : null}

        <ListSection title="Despre">
          <ListItem
            icon="shield-checkmark-outline"
            title="Politica de confidențialitate"
            onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
          />
          <ListItem
            icon="document-text-outline"
            title="Termeni și condiții"
            onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}
          />
        </ListSection>

        {signedIn ? (
          <ListSection>
            <ListItem icon="log-out-outline" title="Deconectare" destructive onPress={() => void logout()} />
            <ListItem
              icon="trash-outline"
              title="Șterge contul"
              subtitle="Datele contului se șterg definitiv"
              destructive
              onPress={() => confirmDeleteAccount(() => void deleteAccount())}
            />
          </ListSection>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.grouped },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  intro: { paddingHorizontal: spacing.xxs },
  form: { padding: spacing.md, gap: spacing.xs },
  input: {
    height: 48,
    borderRadius: radii.md,
    ...continuous,
    backgroundColor: colors.well,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    ...Platform.select({ web: { outlineWidth: 0 }, default: {} }),
  },
});

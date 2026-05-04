import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '../components/Skeleton';
import type { AccountSettings, AccountSettingsPatch } from '../services/commerce';
import { fixRomanianMojibake } from '../utils/string';
import type { ScreenStyles } from './screenTypes';
import { colors, spacing } from '../theme/tokens';

type SettingsScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  isAuthenticated: boolean;
  accountEmail: string;
  settings: AccountSettings;
  biometricEnabled: boolean;
  onUpdateSettings: (patch: AccountSettingsPatch) => Promise<void>;
  onToggleBiometricLogin: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onOpenSessions: () => void;
  onLogout: () => void;
  onGoLogin: () => void;
};

const source = 'mobile_app';

export const SettingsScreen = ({
  styles,
  isLoading,
  isAuthenticated,
  accountEmail,
  settings,
  biometricEnabled,
  onUpdateSettings,
  onToggleBiometricLogin,
  onChangePassword,
  onOpenSessions,
  onLogout,
  onGoLogin,
}: SettingsScreenProps) => {
  const [displayName, setDisplayName] = useState(settings.profile.displayName);
  const [locale, setLocale] = useState(settings.profile.locale);
  const [busySection, setBusySection] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setDisplayName(settings.profile.displayName);
    setLocale(settings.profile.locale);
  }, [settings.profile.displayName, settings.profile.locale]);

  const setFeedback = (message: string, tone: 'success' | 'error') => {
    setStatusTone(tone);
    setStatusMessage(message);
  };

  const runSave = async (section: string, patch: AccountSettingsPatch, successMessage: string) => {
    setBusySection(section);
    try {
      await onUpdateSettings(patch);
      setFeedback(successMessage, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut salva setarile.';
      setFeedback(message, 'error');
    } finally {
      setBusySection(null);
    }
  };

  const saveProfile = async () => {
    const nextDisplayName = displayName.trim();
    const nextLocale = locale.trim();
    if (nextDisplayName.length < 2) {
      setFeedback('Numele afisat trebuie sa aiba minimum 2 caractere.', 'error');
      return;
    }
    if (nextLocale.length < 2) {
      setFeedback('Locale invalid. Exemplu: ro-RO sau en-US.', 'error');
      return;
    }

    await runSave(
      'profile',
      { profile: { displayName: nextDisplayName, locale: nextLocale } },
      'Profilul a fost actualizat.',
    );
  };

  const runToggle = async (
    section: string,
    patch: AccountSettingsPatch,
    successMessage: string,
  ) => {
    await runSave(section, patch, successMessage);
  };

  const submitPasswordChange = async () => {
    const current = currentPassword.trim();
    const next = newPassword.trim();
    if (!isAuthenticated) {
      setFeedback('Autentifica-te pentru schimbarea parolei.', 'error');
      return;
    }
    if (!current || !next) {
      setFeedback('Completeaza parola curenta si parola noua.', 'error');
      return;
    }
    if (next.length < 8) {
      setFeedback('Parola noua trebuie sa aiba minimum 8 caractere.', 'error');
      return;
    }

    setBusySection('password');
    try {
      await onChangePassword(current, next);
      setCurrentPassword('');
      setNewPassword('');
      setFeedback('Parola a fost actualizata.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut schimba parola.';
      setFeedback(message, 'error');
    } finally {
      setBusySection(null);
    }
  };

  const marketingGranted = settings.privacy.marketingConsent.granted;
  const statusStyle = useMemo(
    () => [styles.bodyMuted, statusTone === 'error' ? styles.errorText : null],
    [statusTone, styles.bodyMuted, styles.errorText],
  );
  const normalizedStatusMessage = statusMessage ? fixRomanianMojibake(statusMessage) : null;

  if (isLoading) {
    return (
      <View style={styles.stackLarge}>
        <Skeleton height={120} />
        <Skeleton height={170} />
        <Skeleton height={120} />
      </View>
    );
  }

  return (
    <View style={styles.stackLarge}>
      <View style={styles.cardPlain}>
        <Text style={styles.pageHeading}>Setari cont</Text>
        <Text style={styles.bodyMuted}>
          {isAuthenticated ? accountEmail : 'Mod local: setari disponibile pe dispozitiv'}
        </Text>
        {!isAuthenticated ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onGoLogin}>
            <Text style={styles.secondaryButtonText}>Autentificare pentru sincronizare server</Text>
          </TouchableOpacity>
        ) : null}
        {normalizedStatusMessage ? (
          <Text style={statusStyle}>{normalizedStatusMessage}</Text>
        ) : null}
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="person-outline" size={18} color={colors.brandBlue} />
          <Text style={styles.sectionLabel}>Profile</Text>
        </View>
        <Text style={styles.bodyMuted}>Nume afisat si limba preferata.</Text>
        <TextInput
          style={styles.addressInput}
          placeholder="Nume afisat"
          value={displayName}
          onChangeText={setDisplayName}
          editable={isAuthenticated && busySection !== 'profile'}
        />
        <TextInput
          style={styles.addressInput}
          placeholder="Locale (ex: ro-RO)"
          value={locale}
          onChangeText={setLocale}
          editable={isAuthenticated && busySection !== 'profile'}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={saveProfile}
          disabled={!isAuthenticated || busySection === 'profile'}
        >
          <Text style={styles.primaryButtonText}>
            {busySection === 'profile' ? 'Se salveaza...' : 'Salveaza profilul'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="notifications-outline" size={18} color={colors.brandAmber} />
          <Text style={styles.sectionLabel}>Notifications</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Emailuri comanda</Text>
            <Text style={styles.bodyMuted}>Stare livrare si modificari comanda</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.notifications.email.orderUpdates && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'notifications',
                {
                  notifications: {
                    email: { orderUpdates: !settings.notifications.email.orderUpdates },
                  },
                },
                'Preferinta de notificari email a fost actualizata.',
              )
            }
            disabled={!isAuthenticated || busySection === 'notifications'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.notifications.email.orderUpdates && styles.settingToggleTextActive,
              ]}
            >
              {settings.notifications.email.orderUpdates ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Push alerte securitate</Text>
            <Text style={styles.bodyMuted}>Alerte la autentificari suspecte</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.notifications.push.securityAlerts && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'notifications',
                {
                  notifications: {
                    push: { securityAlerts: !settings.notifications.push.securityAlerts },
                  },
                },
                'Notificarile push de securitate au fost actualizate.',
              )
            }
            disabled={!isAuthenticated || busySection === 'notifications'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.notifications.push.securityAlerts && styles.settingToggleTextActive,
              ]}
            >
              {settings.notifications.push.securityAlerts ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Push back-in-stock</Text>
            <Text style={styles.bodyMuted}>Anunt cand produsele favorite revin in stoc</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.notifications.push.backInStock && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'notifications',
                {
                  notifications: {
                    push: { backInStock: !settings.notifications.push.backInStock },
                  },
                },
                'Preferinta back-in-stock a fost actualizata.',
              )
            }
            disabled={!isAuthenticated || busySection === 'notifications'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.notifications.push.backInStock && styles.settingToggleTextActive,
              ]}
            >
              {settings.notifications.push.backInStock ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="shield-outline" size={18} color={colors.brandBlue} />
          <Text style={styles.sectionLabel}>Privacy</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Analytics</Text>
            <Text style={styles.bodyMuted}>Date aggregate pentru imbunatatiri produs</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.privacy.analyticsConsent.granted && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'privacy',
                {
                  privacy: {
                    analyticsConsent: {
                      granted: !settings.privacy.analyticsConsent.granted,
                      source,
                    },
                  },
                },
                'Consimtamantul pentru analytics a fost actualizat.',
              )
            }
            disabled={busySection === 'privacy'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.privacy.analyticsConsent.granted && styles.settingToggleTextActive,
              ]}
            >
              {settings.privacy.analyticsConsent.granted ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Personalizare</Text>
            <Text style={styles.bodyMuted}>Recomandari bazate pe comportament</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.privacy.personalizationConsent.granted && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'privacy',
                {
                  privacy: {
                    personalizationConsent: {
                      granted: !settings.privacy.personalizationConsent.granted,
                      source,
                    },
                  },
                },
                'Consimtamantul de personalizare a fost actualizat.',
              )
            }
            disabled={busySection === 'privacy'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.privacy.personalizationConsent.granted && styles.settingToggleTextActive,
              ]}
            >
              {settings.privacy.personalizationConsent.granted ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Marketing</Text>
            <Text style={styles.bodyMuted}>
              Sursa unica pentru acordul de comunicari comerciale
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingToggle, marketingGranted && styles.settingToggleActive]}
            onPress={() =>
              runToggle(
                'privacy',
                {
                  privacy: { marketingConsent: { granted: !marketingGranted, source } },
                  notifications: {
                    email: { marketing: !marketingGranted },
                    push: { marketing: !marketingGranted },
                    inApp: { marketing: !marketingGranted },
                  },
                },
                'Consimtamantul de marketing a fost actualizat.',
              )
            }
            disabled={busySection === 'privacy'}
          >
            <Text
              style={[styles.settingToggleText, marketingGranted && styles.settingToggleTextActive]}
            >
              {marketingGranted ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.brandRed} />
          <Text style={styles.sectionLabel}>Security</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Login biometric</Text>
            <Text style={styles.bodyMuted}>Optiune locala pe acest dispozitiv</Text>
          </View>
          <TouchableOpacity
            style={[styles.settingToggle, biometricEnabled && styles.settingToggleActive]}
            onPress={onToggleBiometricLogin}
          >
            <Text
              style={[styles.settingToggleText, biometricEnabled && styles.settingToggleTextActive]}
            >
              {biometricEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Alerte login</Text>
            <Text style={styles.bodyMuted}>Notificari la autentificari noi</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.security.loginAlerts && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'security',
                { security: { loginAlerts: !settings.security.loginAlerts } },
                'Alertele de login au fost actualizate.',
              )
            }
            disabled={!isAuthenticated || busySection === 'security'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.security.loginAlerts && styles.settingToggleTextActive,
              ]}
            >
              {settings.security.loginAlerts ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.bodyText}>Two-factor authentication</Text>
            <Text style={styles.bodyMuted}>Strat suplimentar pentru autentificare</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.settingToggle,
              settings.security.twoFactorEnabled && styles.settingToggleActive,
            ]}
            onPress={() =>
              runToggle(
                'security',
                { security: { twoFactorEnabled: !settings.security.twoFactorEnabled } },
                'Setarea 2FA a fost actualizata.',
              )
            }
            disabled={!isAuthenticated || busySection === 'security'}
          >
            <Text
              style={[
                styles.settingToggleText,
                settings.security.twoFactorEnabled && styles.settingToggleTextActive,
              ]}
            >
              {settings.security.twoFactorEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.addressInput}
          placeholder="Parola curenta"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          editable={isAuthenticated && busySection !== 'password'}
        />
        <TextInput
          style={styles.addressInput}
          placeholder="Parola noua"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          editable={isAuthenticated && busySection !== 'password'}
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={submitPasswordChange}
          disabled={!isAuthenticated || busySection === 'password'}
        >
          <Text style={styles.secondaryButtonText}>
            {busySection === 'password' ? 'Se actualizeaza...' : 'Schimba parola'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardPlain}>
        <View style={styles.sectionHeadRow}>
          <Ionicons name="desktop-outline" size={18} color={colors.brandBlue} />
          <Text style={styles.sectionLabel}>Sessions</Text>
        </View>
        <Text style={styles.bodyMuted}>
          Gestioneaza dispozitivele conectate si sesiunea curenta.
        </Text>
        <View style={styles.accountInlineActions}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
            ]}
            onPress={onOpenSessions}
            disabled={!isAuthenticated}
          >
            <Ionicons name="eye-outline" size={16} color={colors.brandBlue} />
            <Text style={styles.secondaryButtonText}>Vezi sesiuni active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
            ]}
            onPress={onLogout}
            disabled={!isAuthenticated}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.brandRed} />
            <Text style={styles.secondaryButtonText}>Deconectare</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

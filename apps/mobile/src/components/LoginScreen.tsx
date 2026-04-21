import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/tokens';

type LoginScreenProps = {
  email: string;
  password: string;
  busy: boolean;
  errorMessage: string | null;
  sessionsCount: number;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
  onOpenSessions: () => void;
  onResetPassword: () => void;
  onGoRegister: () => void;
};

export function LoginScreen({
  email,
  password,
  busy,
  errorMessage,
  sessionsCount,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onOpenSessions,
  onResetPassword,
  onGoRegister,
}: LoginScreenProps) {
  return (
    <View style={styles.stackLarge}>
      <View style={styles.cardPlain}>
        <Text style={styles.pageHeading}>Autentificare</Text>
        <Text style={styles.bodyMuted}>Intră în contul tău Dacus.</Text>

        <View style={styles.stackSmall}>
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
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.stackSmall}>
          <TouchableOpacity style={[styles.primaryButton, busy && styles.buttonDisabled]} onPress={onLogin} disabled={busy}>
            <Text style={styles.primaryButtonText}>{busy ? 'Se procesează...' : 'Intră în cont'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onOpenSessions} disabled={busy}>
            <Text style={styles.secondaryButtonText}>Sesiuni dispozitiv ({sessionsCount})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onResetPassword} disabled={busy}>
            <Text style={styles.secondaryButtonText}>Reset parolă</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onGoRegister} disabled={busy}>
            <Text style={styles.secondaryButtonText}>Nu ai cont? Creează unul</Text>
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
});

import { StackActions, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { useApp } from '../state/AppProvider';
import { colors, hitSlop, spacing } from '../theme/tokens';
import { AppText, Button, enterUp, IconButton, TextField, Touchable } from '../ui';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logo = require('../../assets/dacus-logo.png');

export function LoginScreen() {
  const navigation = useNavigation();
  const { login, requestPasswordReset, authBusy, authError, clearAuthError } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <IconButton icon="close" accessibilityLabel="Închide" onPress={() => navigation.goBack()} size={38} />,
    });
  }, [navigation]);

  const onChangeEmail = (value: string) => {
    setEmail(value);
    if (authError) clearAuthError();
  };

  const onChangePassword = (value: string) => {
    setPassword(value);
    if (authError) clearAuthError();
  };

  const submit = () => void login(email, password);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enterUp(0)} style={styles.hero}>
          <Image source={logo} style={styles.logo} contentFit="contain" accessibilityLabel="Dacus" />
          <AppText variant="title1">Bine ai revenit</AppText>
          <AppText variant="body" tone="secondary">
            Intră în cont pentru comenzi, puncte de fidelitate și adrese salvate.
          </AppText>
        </Animated.View>

        <Animated.View entering={enterUp(1)} style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={onChangeEmail}
            placeholder="nume@exemplu.ro"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            enterKeyHint="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
          <TextField
            inputRef={passwordRef}
            label="Parolă"
            value={password}
            onChangeText={onChangePassword}
            placeholder="Parola ta"
            password
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            enterKeyHint="go"
            onSubmitEditing={submit}
            error={authError}
          />

          <Touchable
            onPress={() => void requestPasswordReset(email)}
            hitSlop={hitSlop}
            pressedScale={0.97}
            style={styles.forgot}
            disabled={authBusy}
          >
            <AppText variant="subheadMedium">Ai uitat parola?</AppText>
          </Touchable>

          <Button title="Intră în cont" size="lg" fullWidth loading={authBusy} onPress={submit} />
        </Animated.View>

        <Animated.View entering={enterUp(2)} style={styles.switchRow}>
          <AppText variant="body" tone="secondary">
            Nu ai cont?
          </AppText>
          <Touchable
            onPress={() => navigation.dispatch(StackActions.replace('Register'))}
            hitSlop={hitSlop}
            pressedScale={0.97}
            disabled={authBusy}
          >
            <AppText variant="headline" tone="brand">
              Creează unul
            </AppText>
          </Touchable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxxl, gap: spacing.xl },
  hero: { gap: spacing.xs },
  logo: { width: 120, height: 39, marginBottom: spacing.sm },
  form: { gap: spacing.md },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.xxs },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
});

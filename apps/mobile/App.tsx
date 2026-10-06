import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { Barlow_800ExtraBold } from '@expo-google-fonts/barlow/800ExtraBold';
import { Barlow_800ExtraBold_Italic } from '@expo-google-fonts/barlow/800ExtraBold_Italic';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from './src/components/ErrorBoundary';
import { navigationRef } from './src/navigation/navigationRef';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProvider } from './src/state/AppProvider';
import { colors, fonts, spacing } from './src/theme/tokens';
import { AppText } from './src/ui/AppText';
import { ToastProvider } from './src/ui/Toast';

// The splash stays up while the fonts and the bundled catalog load and the first screen renders.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Only the weights the design uses are bundled.
const FONT_FILES = {
  [fonts.regular]: Barlow_400Regular,
  [fonts.medium]: Barlow_500Medium,
  [fonts.semibold]: Barlow_600SemiBold,
  [fonts.bold]: Barlow_700Bold,
  [fonts.extrabold]: Barlow_800ExtraBold,
  [fonts.extraboldItalic]: Barlow_800ExtraBold_Italic,
};

// Weights come from the font files; 'normal' keeps Android from synthesising bold on top.
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.canvas,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.line,
    notification: colors.brand,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
    bold: { fontFamily: fonts.semibold, fontWeight: 'normal' },
    heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
  },
};

type GlobalErrorUtils = {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

export default function App() {
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  useEffect(() => {
    const errorUtils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
    if (!errorUtils?.setGlobalHandler) return;

    const previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error('Global runtime error', { isFatal: Boolean(isFatal), message: error?.message, stack: error?.stack });
      if (isFatal) {
        setFatalError(error);
        void SplashScreen.hideAsync().catch(() => undefined);
        return;
      }
      previousHandler?.(error, isFatal);
    });

    return () => {
      if (previousHandler) errorUtils.setGlobalHandler?.(previousHandler);
    };
  }, []);

  useEffect(() => {
    // Without the fonts the app still works (system font), so a load failure only gets logged.
    if (fontError) console.warn('Fonts failed to load', fontError.message);
  }, [fontError]);

  if (fatalError) {
    return (
      <View style={styles.fatal}>
        <AppText variant="title2" align="center">
          Aplicația a întâmpinat o eroare
        </AppText>
        <AppText variant="body" tone="secondary" align="center">
          Închide și redeschide aplicația. Dacă problema persistă, reinstalează aplicația.
        </AppText>
        <AppText variant="caption" tone="tertiary" align="center">
          {fatalError.message}
        </AppText>
      </View>
    );
  }

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary
      onError={(error, errorInfo) =>
        console.error('Fatal render error', { message: error.message, componentStack: errorInfo.componentStack })
      }
    >
      <SafeAreaProvider>
        <ToastProvider>
          <AppProvider>
            <NavigationContainer
              ref={navigationRef}
              theme={navigationTheme}
              onReady={() => void SplashScreen.hideAsync().catch(() => undefined)}
            >
              <StatusBar barStyle="dark-content" />
              <RootNavigator />
            </NavigationContainer>
          </AppProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fatal: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
});

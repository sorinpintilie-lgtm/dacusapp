import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/tokens';
import { AppText, IconButton } from '../ui';

export function ImageViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ImageViewer'>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const imageStyle = { width, height: height * 0.8 };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      {Platform.OS === 'ios' ? (
        // iOS scroll views zoom natively with a pinch.
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.center}
        >
          <Image source={route.params.uri} style={imageStyle} contentFit="contain" transition={150} />
        </ScrollView>
      ) : (
        <Pressable
          style={styles.center}
          onPress={() => setZoomed((current) => !current)}
          accessibilityLabel={zoomed ? 'Micșorează' : 'Mărește'}
        >
          <Image
            source={route.params.uri}
            style={[imageStyle, { transform: [{ scale: zoomed ? 2 : 1 }] }]}
            contentFit="contain"
            transition={150}
          />
        </Pressable>
      )}

      <IconButton
        icon="close"
        accessibilityLabel="Închide"
        onPress={() => navigation.goBack()}
        color={colors.textInverse}
        style={[styles.close, { top: insets.top + spacing.sm }]}
      />
      <AppText variant="caption" style={[styles.hint, { bottom: insets.bottom + spacing.md }]} align="center">
        {Platform.OS === 'ios' ? 'Apropie două degete pentru zoom' : 'Atinge imaginea pentru zoom'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  center: { flexGrow: 1, flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  close: { position: 'absolute', right: spacing.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  hint: { position: 'absolute', left: 0, right: 0, color: 'rgba(255,255,255,0.7)' },
});

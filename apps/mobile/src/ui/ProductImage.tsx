import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/tokens';

type ProductImageProps = {
  uri: string | undefined;
  /** Lower-resolution image shown while `uri` loads. */
  placeholderUri?: string;
  iconSize?: number;
  /** How the photo fits its box (product shots: contain; category covers: cover). */
  fit?: 'contain' | 'cover';
  style?: StyleProp<ImageStyle>;
};

const isHttpUrl = (value: string | undefined): value is string =>
  !!value && /^https?:\/\//.test(value);

/** Soft breathing tone over the image box while the photo is on its way. */
function LoadingPulse() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 850,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + pulse.value * 0.45 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, style]} />
  );
}

/**
 * Product photo with a loading pulse, falling back to a quiet icon when there is no photo
 * or it fails to load (deleted in the shop, offline).
 */
export function ProductImage({
  uri,
  placeholderUri,
  iconSize = 28,
  fit = 'contain',
  style,
}: ProductImageProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);

  if (!isHttpUrl(uri) || failedUri === uri) {
    return (
      <View style={styles.fallback} accessibilityLabel="Fără imagine">
        <Ionicons name="image-outline" size={iconSize} color={colors.textTertiary} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {loadedUri !== uri ? <LoadingPulse /> : null}
      <Image
        source={uri}
        placeholder={isHttpUrl(placeholderUri) ? placeholderUri : undefined}
        style={[styles.image, style]}
        contentFit={fit}
        transition={180}
        onLoad={() => setLoadedUri(uri)}
        onError={() => setFailedUri(uri)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignSelf: 'stretch' },
  image: { width: '100%', height: '100%' },
  pulse: { backgroundColor: colors.wellStrong },
  fallback: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});

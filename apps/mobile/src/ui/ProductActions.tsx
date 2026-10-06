import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, continuous, hitSlop, radii, shadows } from '../theme/tokens';
import { haptics } from './haptics';
import { springs } from './motion';
import { Touchable } from './Touchable';

const ADDED_FEEDBACK_MS = 1200;

type AddButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Quick add-to-cart: turns red with a check for a moment, so the tap is confirmed on the card itself. */
export function AddToCartButton({ onPress, accessibilityLabel, size = 36, style }: AddButtonProps) {
  const [added, setAdded] = useState(false);
  const progress = useSharedValue(0);
  const pop = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.ink, colors.brand]),
    transform: [{ scale: pop.value }],
  }));

  const handlePress = () => {
    onPress();
    setAdded(true);
    progress.value = withTiming(1, { duration: 140 });
    pop.value = withSequence(withSpring(1.18, springs.pop), withSpring(1, springs.pop));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAdded(false);
      progress.value = withTiming(0, { duration: 260 });
    }, ADDED_FEEDBACK_MS);
  };

  return (
    <Touchable
      onPress={handlePress}
      hitSlop={hitSlop}
      pressedScale={0.88}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View
        style={[styles.add, { width: size, height: size, borderRadius: Math.round(size * 0.34) }, animatedStyle]}
      >
        <Ionicons name={added ? 'checkmark' : 'add'} size={Math.round(size * 0.58)} color={colors.textInverse} />
      </Animated.View>
    </Touchable>
  );
}

type HeartButtonProps = {
  active: boolean;
  onPress: () => void;
  size?: number;
  /** White disc behind the heart, for photos with busy backgrounds. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Favourite toggle with a small pop when it fills. */
export function HeartButton({ active, onPress, size = 34, floating = false, style }: HeartButtonProps) {
  const scale = useSharedValue(1);
  const previous = useRef(active);

  useEffect(() => {
    if (active && !previous.current) {
      scale.value = withSequence(withSpring(1.32, springs.pop), withSpring(1, springs.pop));
    }
    previous.current = active;
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Touchable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      hitSlop={hitSlop}
      pressedScale={0.85}
      accessibilityLabel={active ? 'Elimină din favorite' : 'Adaugă la favorite'}
      accessibilityState={{ selected: active }}
      style={[styles.heart, { width: size, height: size }, floating && styles.heartFloating, style]}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={active ? 'heart' : 'heart-outline'}
          size={Math.round(size * 0.58)}
          color={active ? colors.brand : colors.textPrimary}
        />
      </Animated.View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  add: { alignItems: 'center', justifyContent: 'center', ...continuous },
  heart: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  heartFloating: { backgroundColor: colors.surface, ...shadows.float },
});

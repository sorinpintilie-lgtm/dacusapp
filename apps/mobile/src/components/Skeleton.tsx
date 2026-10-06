import { useEffect } from 'react';
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii } from '../theme/tokens';

type SkeletonProps = {
  height?: number;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder block that breathes while content loads. */
export const Skeleton = ({ height = 14, width = '100%', radius = radii.sm, style }: SkeletonProps) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }));

  return <Animated.View style={[styles.skeleton, { height, width, borderRadius: radius }, animatedStyle, style]} />;
};

const styles = StyleSheet.create({
  skeleton: { backgroundColor: colors.skeleton },
});

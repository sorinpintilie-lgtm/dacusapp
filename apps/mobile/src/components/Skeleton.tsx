import { useEffect, useRef } from 'react';
import { Animated, Easing, type DimensionValue, StyleSheet } from 'react-native';

import { colors, radii } from '../theme/tokens';

type SkeletonProps = {
  height?: number;
  width?: DimensionValue;
};

export const Skeleton = ({ height = 14, width = '100%' }: SkeletonProps) => {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 820,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return <Animated.View style={[styles.skeleton, { height, width, opacity: pulse }]} />;
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.skeletonShine,
  },
});

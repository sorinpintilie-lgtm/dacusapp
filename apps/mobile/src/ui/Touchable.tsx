import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptics } from './haptics';
import { springs } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale while pressed; 1 turns the effect off. */
  pressedScale?: number;
  /** Dims the control while disabled (default on). */
  dimWhenDisabled?: boolean;
  haptic?: 'selection' | 'light';
};

/** Pressable that gives way slightly under the finger (spring) with optional haptic feedback. */
export function Touchable({
  style,
  children,
  pressedScale = 0.97,
  dimWhenDisabled = true,
  haptic,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: TouchableProps) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - pressedScale) * pressed.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle, disabled && dimWhenDisabled ? { opacity: 0.4 } : null]}
      onPressIn={(event: GestureResponderEvent) => {
        if (pressedScale !== 1) pressed.value = withSpring(1, springs.press);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressed.value = withSpring(0, springs.press);
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) haptics[haptic]();
        onPress?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

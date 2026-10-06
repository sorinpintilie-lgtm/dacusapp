import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { colors, fonts } from '../theme/tokens';
import { springs } from '../ui/motion';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type TabIconProps = {
  name: IconName;
  focused: boolean;
  color: string;
  badge?: number;
};

/** Tab icon that dips and springs back when selected; its badge pops when the count grows. */
export function TabIcon({ name, focused, color, badge = 0 }: TabIconProps) {
  const scale = useSharedValue(1);
  const badgeScale = useSharedValue(1);
  const wasFocused = useRef(focused);
  const previousBadge = useRef(badge);

  useEffect(() => {
    if (focused && !wasFocused.current) {
      scale.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, springs.pop));
    }
    wasFocused.current = focused;
  }, [focused, scale]);

  useEffect(() => {
    if (badge > previousBadge.current) {
      badgeScale.value = withSequence(withSpring(1.45, springs.pop), withSpring(1, springs.pop));
      scale.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, springs.pop));
    }
    previousBadge.current = badge;
  }, [badge, badgeScale, scale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  return (
    <Animated.View style={[styles.icon, iconStyle]}>
      <Ionicons name={name} size={24} color={color} />
      {badge > 0 ? (
        <Animated.View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 30, height: 24, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -5,
    left: 16,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.textInverse, fontFamily: fonts.bold, fontSize: 10, lineHeight: 12 },
});

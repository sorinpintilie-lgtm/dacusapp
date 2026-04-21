import { Animated, Easing } from 'react-native';

/**
 * Animation configurations for the Dacus app
 * Provides smooth transitions and micro-interactions
 */

// Animation durations
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// Easing functions
export const ANIMATION_EASING = {
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  accelerate: Easing.bezier(0.4, 0, 1, 1),
  decelerate: Easing.bezier(0, 0, 0.2, 1),
  bounce: Easing.bezier(0.68, -0.55, 0.265, 1.55),
} as const;

/**
 * Animation helper for adding items to cart
 */
export function animateAddToCart(scaleValue: Animated.Value, onComplete?: () => void): void {
  Animated.sequence([
    Animated.timing(scaleValue, {
      toValue: 1.1,
      duration: 100,
      useNativeDriver: true,
    }),
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }),
  ]).start(onComplete);
}

/**
 * Animation helper for price change
 */
export function animatePriceChange(scaleValue: Animated.Value): void {
  Animated.sequence([
    Animated.timing(scaleValue, {
      toValue: 1.1,
      duration: 150,
      useNativeDriver: true,
    }),
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }),
  ]).start();
}

/**
 * Creates staggered animation delay for lists
 */
export function createStaggerDelay(index: number, baseDelay: number = 50): number {
  return index * baseDelay;
}

/**
 * Skeleton shimmer animation config
 */
export const SHIMMER_ANIMATION = {
  duration: 1500,
  easing: Easing.linear,
};

/**
 * Default spring animation config
 */
export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

/**
 * Hook for handling press animations on buttons
 */
export function usePressAnimation() {
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      ...SPRING_CONFIG,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...SPRING_CONFIG,
    }).start();
  };

  return {
    scale,
    handlePressIn,
    handlePressOut,
  };
}

/**
 * Hook for fade-in animation on mount
 */
export function useFadeInAnimation(duration: number = ANIMATION_DURATION.normal) {
  const opacity = new Animated.Value(0);

  const fadeIn = (delay: number = 0) => {
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
        easing: ANIMATION_EASING.decelerate,
      }).start();
    }, delay);
  };

  return { opacity, fadeIn };
}

/**
 * Hook for slide-in animation from right
 */
export function useSlideInAnimation(duration: number = ANIMATION_DURATION.normal) {
  const translateX = new Animated.Value(50);
  const opacity = new Animated.Value(0);

  const slideIn = (delay: number = 0) => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration,
          useNativeDriver: true,
          easing: ANIMATION_EASING.standard,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
  };

  return { translateX, opacity, slideIn };
}

/**
 * Creates a loading pulse animation
 */
export function usePulseAnimation() {
  const pulse = new Animated.Value(1);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const stopPulse = () => {
    pulse.stopAnimation();
    pulse.setValue(1);
  };

  return { pulse, startPulse, stopPulse };
}

/**
 * Animation for wishlist heart
 */
export function useWishlistAnimation() {
  const scale = new Animated.Value(1);

  const animate = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return { scale, animate };
}

/**
 * Animation for quantity change
 */
export function useQuantityAnimation() {
  const scale = new Animated.Value(1);

  const animateIncrement = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return { scale, animateIncrement };
}

import { Platform } from 'react-native';
import { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

/**
 * Motion vocabulary. Every animation in the app answers one of: feedback (a tap was received),
 * state change (something was added/removed) or hierarchy (content arriving in reading order).
 * All of them follow the system "reduce motion" setting.
 */
export const springs = {
  /** Press-in / press-out of anything tappable. */
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  /** Small celebratory pops: heart, add-to-cart check, cart badge. */
  pop: { damping: 9, stiffness: 260, mass: 0.6 },
  /** Sheets and panels. */
  panel: { damping: 28, stiffness: 280, mass: 0.9 },
};

export const durations = { fast: 160, base: 240, slow: 420 };

const MAX_STAGGER_STEPS = 6;

// Reanimated's web layout animations pin custom (non-preset) entering animations with absolute positioning
// and break list layouts, so entrances and layout transitions are native-only. Web is only a dev preview.
const layoutAnimationsEnabled = Platform.OS !== 'web';

/** Content rising into place, staggered by position (capped so long lists don't lag). */
export const enterUp = (index = 0) =>
  layoutAnimationsEnabled
    ? FadeInDown.duration(durations.slow)
        .delay(Math.min(index, MAX_STAGGER_STEPS) * 60)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })
        .reduceMotion(ReduceMotion.System)
    : undefined;

export const fadeIn = FadeIn.duration(durations.base).reduceMotion(ReduceMotion.System);
export const fadeOut = FadeOut.duration(durations.fast).reduceMotion(ReduceMotion.System);

/** Neighbours sliding into the gap when a row is removed. */
export const listLayout = layoutAnimationsEnabled
  ? LinearTransition.duration(durations.base).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)
  : undefined;

/** A number rolling in from the direction it changed (quantity steppers). */
export const rollIn = (direction: 'up' | 'down') =>
  layoutAnimationsEnabled
    ? (direction === 'up' ? FadeInDown : FadeInUp)
        .duration(180)
        .withInitialValues({ opacity: 0, transform: [{ translateY: direction === 'up' ? 8 : -8 }] })
        .reduceMotion(ReduceMotion.System)
    : undefined;

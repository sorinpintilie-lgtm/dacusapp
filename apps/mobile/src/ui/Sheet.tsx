import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, continuous, radii, spacing } from '../theme/tokens';
import { AppText } from './AppText';
import { IconButton } from './IconButton';
import { springs } from './motion';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Pinned below the scrolling content (e.g. Apply / Reset buttons). */
  footer?: ReactNode;
};

/** Bottom sheet: springs up over a dimmed backdrop; back button, backdrop tap and the close button dismiss it. */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reduceMotion ? withTiming(1, { duration: 1 }) : withSpring(1, springs.panel);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: reduceMotion ? 1 : 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [mounted, progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * height }] }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Închide" />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: insets.bottom + spacing.sm }, sheetStyle]}
        accessibilityViewIsModal
      >
        <View style={styles.handle} />
        {title ? (
          <View style={styles.header}>
            <AppText variant="title2" style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </AppText>
            <IconButton icon="close" accessibilityLabel="Închide" onPress={onClose} size={36} variant="soft" />
          </View>
        ) : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...continuous,
    paddingTop: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: { flex: 1 },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});

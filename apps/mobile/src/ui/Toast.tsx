import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOutUp, ReduceMotion, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, continuous, fonts, radii, shadows, spacing } from '../theme/tokens';
import { haptics } from './haptics';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastOptions = {
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ActiveToast = ToastOptions & { id: number; message: string; tone: ToastTone };

type ToastApi = {
  show: (message: string, options?: ToastOptions | ToastTone) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneIcon = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
} as const;

const toneColor = {
  success: '#FFFFFF',
  error: '#FF8A80',
  info: '#FFFFFF',
};

const entering = SlideInUp.springify().damping(20).stiffness(220).reduceMotion(ReduceMotion.System);
const exiting = FadeOutUp.duration(180).reduceMotion(ReduceMotion.System);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, options?: ToastOptions | ToastTone) => {
      const settings: ToastOptions = typeof options === 'string' ? { tone: options } : (options ?? {});
      const tone = settings.tone ?? 'success';
      if (hideTimer.current) clearTimeout(hideTimer.current);
      nextId.current += 1;
      setToast({ ...settings, id: nextId.current, message, tone });
      hideTimer.current = setTimeout(hide, settings.durationMs ?? (settings.actionLabel ? 4000 : 2600));
      if (tone === 'error') haptics.error();
    },
    [hide],
  );

  const api = useMemo(() => ({ show, hide }), [hide, show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.xs }]}>
        {toast ? (
          // Keyed by id: a new toast replaces the old one with a fresh slide-in.
          <Animated.View key={toast.id} entering={entering} exiting={exiting} style={styles.toast}>
            <Pressable style={styles.body} onPress={hide} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Ionicons name={toneIcon[toast.tone]} size={20} color={toneColor[toast.tone]} />
              <Text style={styles.message} numberOfLines={2}>
                {toast.message}
              </Text>
            </Pressable>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                onPress={() => {
                  toast.onAction?.();
                  hide();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.actionLabel}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.sm, right: spacing.sm, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inkSoft,
    borderRadius: radii.md,
    ...continuous,
    ...shadows.raised,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  message: { flex: 1, color: colors.textInverse, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  action: {
    marginRight: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
  },
  actionPressed: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  actionLabel: { color: colors.textInverse, fontFamily: fonts.semibold, fontSize: 14 },
});

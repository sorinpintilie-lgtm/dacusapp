import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

/**
 * Network status banner that shows when offline
 */
export function NetworkStatusBanner({
  isOffline,
  onRetry,
}: {
  isOffline: boolean;
  onRetry?: () => void;
}) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline && !wasOffline) {
      // Going offline - slide down
      setWasOffline(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    } else if (!isOffline && wasOffline) {
      // Going online - slide up
      Animated.timing(translateY, {
        toValue: -60,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setWasOffline(false));
    }
  }, [isOffline, wasOffline, translateY]);

  if (!wasOffline && !isOffline) {
    return null;
  }

  return (
    <Animated.View style={[styles.networkBanner, { transform: [{ translateY }] }]}>
      <View style={styles.networkBannerContent}>
        <View style={styles.networkIcon}>
          <View style={styles.wifiSlash1} />
          <View style={styles.wifiSlash2} />
        </View>
        <Text style={styles.networkText}>Fără conexiune</Text>
        {onRetry && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.retryText}>Reîncearcă</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Toast notification types
 */
export type ToastType = 'error' | 'success' | 'warning' | 'info';

/**
 * Toast notification configuration
 */
export interface ToastConfig {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Global toast context for showing notifications
 */
interface ToastContextType {
  showToast: (config: Omit<ToastConfig, 'id'>) => void;
  hideToast: (id: string) => void;
}

export const ToastContext = React.createContext<ToastContextType | null>(null);

/**
 * Toast provider component
 */
export function ToastProvider({
  children,
  toasts,
  onRemove,
}: {
  children: React.ReactNode;
  toasts: ToastConfig[];
  onRemove: (id: string) => void;
}) {
  return (
    <ToastContext.Provider value={{ showToast: () => {}, hideToast: onRemove }}>
      {children}
      <View style={styles.toastContainer}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onRemove(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/**
 * Single toast item
 */
function ToastItem({ toast, onDismiss }: { toast: ToastConfig; onDismiss: () => void }) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const dismissToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [onDismiss, opacity, translateY]);

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      dismissToast();
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [dismissToast, opacity, toast.duration, translateY]);

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'error':
        return colors.brandRed;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'info':
        return colors.info;
      default:
        return colors.surfaceDark;
    }
  };

  const getIconContent = () => {
    switch (toast.type) {
      case 'error':
        return (
          <>
            <View style={[styles.toastIconCircle, { borderColor: colors.surface }]} />
            <View style={[styles.toastX1, { backgroundColor: colors.surface }]} />
            <View style={[styles.toastX2, { backgroundColor: colors.surface }]} />
          </>
        );
      case 'success':
        return <View style={[styles.toastCheck, { borderColor: colors.surface }]} />;
      case 'warning':
        return (
          <>
            <View style={[styles.toastExclamationCircle, { borderColor: colors.surface }]} />
            <View style={[styles.toastExclamation, { backgroundColor: colors.surface }]} />
          </>
        );
      case 'info':
        return (
          <>
            <View style={[styles.toastInfoCircle, { borderColor: colors.surface }]} />
            <View style={[styles.toastInfoDot, { backgroundColor: colors.surface }]} />
          </>
        );
    }
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: getBackgroundColor(), opacity },
        { transform: [{ translateY }] },
      ]}
    >
      <View style={styles.toastIcon}>{getIconContent()}</View>
      <Text style={styles.toastMessage}>{toast.message}</Text>
      {toast.action && (
        <TouchableOpacity style={styles.toastAction} onPress={toast.action.onPress}>
          <Text style={styles.toastActionText}>{toast.action.label}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.toastClose}
        onPress={dismissToast}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.toastCloseText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Error modal with retry option
 */
export function ErrorModal({
  visible,
  title = 'Eroare',
  message = 'Ceva nu a mers bine. Te rugăm să încerci din nou.',
  onRetry,
  onDismiss,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalIcon}>
            <View style={[styles.modalCircle, { borderColor: colors.brandRed }]} />
            <View style={[styles.modalX1, { backgroundColor: colors.brandRed }]} />
            <View style={[styles.modalX2, { backgroundColor: colors.brandRed }]} />
          </View>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            {onRetry && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={onRetry}
              >
                <Text style={styles.modalButtonPrimaryText}>Reîncearcă</Text>
              </TouchableOpacity>
            )}
            {onDismiss && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={onDismiss}
              >
                <Text style={styles.modalButtonSecondaryText}>Închide</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Inline error message with retry
 */
export function InlineError({
  message,
  onRetry,
  style,
}: {
  message?: string;
  onRetry?: () => void;
  style?: object;
}) {
  return (
    <View style={[styles.inlineError, style]}>
      <View style={styles.inlineErrorIcon}>
        <View style={[styles.inlineErrorCircle, { borderColor: colors.brandRed }]} />
        <View style={[styles.inlineErrorExclamation, { backgroundColor: colors.brandRed }]} />
      </View>
      <Text style={styles.inlineErrorText}>{message || 'A apărut o eroare'}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.inlineErrorRetry} onPress={onRetry}>
          <Text style={styles.inlineErrorRetryText}>Reîncearcă</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Pull to refresh error state
 */
export function RefreshError({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.refreshErrorContainer}>
      <View style={styles.refreshErrorIcon}>
        <View style={[styles.refreshErrorCircle, { borderColor: colors.textSecondary }]} />
        <View style={[styles.refreshErrorArrow1, { borderColor: colors.textSecondary }]} />
        <View style={[styles.refreshErrorArrow2, { borderColor: colors.textSecondary }]} />
      </View>
      <Text style={styles.refreshErrorText}>Nu s-au putut încărca datele</Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Text style={styles.refreshButtonText}>Actualizează</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Network banner
  networkBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: colors.surfaceDark,
    paddingTop: 40,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  networkBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  networkIcon: {
    width: 20,
    height: 16,
    position: 'relative',
  },
  wifiSlash1: {
    position: 'absolute',
    width: 24,
    height: 2,
    backgroundColor: colors.brandRed,
    top: 7,
    left: -2,
    transform: [{ rotate: '-30deg' }],
  },
  wifiSlash2: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: colors.brandRed,
    top: 7,
    left: 6,
    transform: [{ rotate: '-30deg' }],
  },
  networkText: {
    color: colors.textInverted,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.textInverted,
  },
  retryText: {
    color: colors.textInverted,
    fontSize: 12,
    fontWeight: '600',
  },

  // Toast container
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10000,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  toastIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  toastIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    position: 'absolute',
    top: 2,
    left: 2,
  },
  toastX1: {
    position: 'absolute',
    width: 12,
    height: 2,
    top: 11,
    left: 6,
    transform: [{ rotate: '45deg' }],
  },
  toastX2: {
    position: 'absolute',
    width: 12,
    height: 2,
    top: 11,
    left: 6,
    transform: [{ rotate: '-45deg' }],
  },
  toastCheck: {
    width: 12,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    position: 'absolute',
    top: 8,
    left: 6,
    transform: [{ rotate: '-45deg' }],
  },
  toastExclamationCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    position: 'absolute',
    top: 2,
    left: 2,
  },
  toastExclamation: {
    width: 2,
    height: 8,
    position: 'absolute',
    top: 7,
    left: 11,
    borderRadius: 1,
  },
  toastInfoCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    position: 'absolute',
    top: 2,
    left: 2,
  },
  toastInfoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: 10,
    left: 10,
  },
  toastMessage: {
    flex: 1,
    color: colors.surface,
    fontSize: 14,
    fontWeight: '500',
  },
  toastAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  toastActionText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  toastClose: {
    padding: spacing.xxs,
  },
  toastCloseText: {
    color: colors.surface,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },

  // Error modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalIcon: {
    width: 64,
    height: 64,
    marginBottom: spacing.md,
    position: 'relative',
  },
  modalCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    position: 'absolute',
    top: 4,
    left: 4,
  },
  modalX1: {
    position: 'absolute',
    width: 24,
    height: 3,
    top: 30.5,
    left: 20,
    transform: [{ rotate: '45deg' }],
  },
  modalX2: {
    position: 'absolute',
    width: 24,
    height: 3,
    top: 30.5,
    left: 20,
    transform: [{ rotate: '-45deg' }],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.brandRed,
  },
  modalButtonPrimaryText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonSecondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Inline error
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandRed,
    gap: spacing.sm,
  },
  inlineErrorIcon: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  inlineErrorCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    position: 'absolute',
    top: 1,
    left: 1,
  },
  inlineErrorExclamation: {
    width: 2,
    height: 6,
    position: 'absolute',
    top: 7,
    left: 9,
    borderRadius: 1,
  },
  inlineErrorText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  inlineErrorRetry: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  inlineErrorRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brandRed,
  },

  // Refresh error
  refreshErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  refreshErrorIcon: {
    width: 48,
    height: 48,
    position: 'relative',
  },
  refreshErrorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    position: 'absolute',
    top: 4,
    left: 4,
  },
  refreshErrorArrow1: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.textSecondary,
    top: 20,
    left: 12,
    transform: [{ rotate: '-45deg' }],
  },
  refreshErrorArrow2: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.textSecondary,
    top: 20,
    left: 24,
    transform: [{ rotate: '135deg' }],
  },
  refreshErrorText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  refreshButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brandRed,
    borderRadius: radii.md,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface,
  },
});

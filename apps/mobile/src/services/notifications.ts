import { useCallback, useEffect, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { DevicePushToken } from 'expo-notifications';

type NotificationType =
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'loyalty_points'
  | 'voucher_expiring'
  | 'back_in_stock'
  | 'price_drop'
  | 'general';

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const useNotifications = () => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<
    'undetermined' | 'granted' | 'denied'
  >('undetermined');
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      if (status === 'granted') {
        setNotificationPermission('granted');
        return true;
      }

      if (status === 'denied') {
        setNotificationPermission('denied');
        return false;
      }

      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(newStatus === 'granted' ? 'granted' : 'denied');
      return newStatus === 'granted';
    } catch (error) {
      console.error('[Notifications] Permission error:', error);
      return false;
    }
  }, []);

  const getPushToken = useCallback(async (): Promise<string | null> => {
    try {
      const perm = await requestPermission();
      if (!perm) return null;

      const token = await Notifications.getDevicePushTokenAsync();
      const tokenString = token.data || token.toString();
      setPushToken(tokenString);
      return tokenString;
    } catch (error) {
      console.error('[Notifications] Push token error:', error);
      return null;
    }
  }, [requestPermission]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationPermission(status === 'granted' ? 'granted' : 'denied');

        if (status === 'granted') {
          const token = await getPushToken();
          console.log('[Notifications] Push token:', token);
        }
      } catch (error) {
        console.error('[Notifications] Init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [getPushToken]);

  // Handle notifications when app is in foreground
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notifications] Received:', notification.request.content.title);
    });

    return () => subscription.remove();
  }, []);

  // Handle notification responses (user tapped)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      console.log('[Notifications] Tapped:', data);
    });

    return () => subscription.remove();
  }, []);

  // Send local notification
  const sendLocalNotification = useCallback(async (payload: NotificationPayload): Promise<void> => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: { type: payload.type, ...payload.data },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[Notifications] Local send error:', error);
    }
  }, []);

  // Schedule local notification
  const scheduleNotification = useCallback(
    async (
      payload: NotificationPayload,
      trigger: Notifications.NotificationTriggerInput,
    ): Promise<string | null> => {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: payload.title,
            body: payload.body,
            data: { type: payload.type, ...payload.data },
            sound: 'default',
          },
          trigger,
        });
        return id;
      } catch (error) {
        console.error('[Notifications] Schedule error:', error);
        return null;
      }
    },
    [],
  );

  // Cancel scheduled notification
  const cancelNotification = useCallback(async (id: string): Promise<void> => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.error('[Notifications] Cancel error:', error);
    }
  }, []);

  // Cancel all notifications
  const clearAllNotifications = useCallback(async (): Promise<void> => {
    try {
      await Notifications.dismissAllNotificationsAsync();
      setUnreadCount(0);
    } catch (error) {
      console.error('[Notifications] Clear error:', error);
    }
  }, []);

  // Update badge count
  const setBadge = useCallback(async (count: number): Promise<void> => {
    try {
      await Notifications.setBadgeCountAsync(count);
      setUnreadCount(count);
    } catch (error) {
      console.error('[Notifications] Badge error:', error);
    }
  }, []);

  return {
    pushToken,
    notificationPermission,
    isLoading,
    unreadCount,
    requestPermission,
    getPushToken,
    sendLocalNotification,
    scheduleNotification,
    cancelNotification,
    clearAllNotifications,
    setBadge,
  };
};

// Predefined notification templates
export const notificationTemplates = {
  orderConfirmation: (orderId: string, total: number): NotificationPayload => ({
    type: 'order_confirmation',
    title: 'Comandă confirmată!',
    body: `Comanda #${orderId.slice(-6)} de ${total} RON a fost confirmată.`,
    data: { orderId },
  }),

  orderShipped: (orderId: string, tracking?: string): NotificationPayload => ({
    type: 'order_shipped',
    title: 'Comandă expediată!',
    body: tracking
      ? `Comanda #${orderId.slice(-6)} a fost expediată. Tracking: ${tracking}`
      : `Comanda #${orderId.slice(-6)} a fost expediată.`,
    data: { orderId, tracking },
  }),

  orderDelivered: (orderId: string): NotificationPayload => ({
    type: 'order_delivered',
    title: 'Comandă livrată!',
    body: `Comanda #${orderId.slice(-6)} a fost livrată. Spor la utilizare!`,
    data: { orderId },
  }),

  loyaltyPoints: (points: number, total: number): NotificationPayload => ({
    type: 'loyalty_points',
    title: 'Puncte fidelitate câștigate!',
    body: `Ai câștigat ${points} puncte! Total: ${total} puncte`,
    data: { points, total },
  }),

  voucherExpiring: (voucherCode: string, daysLeft: number): NotificationPayload => ({
    type: 'voucher_expiring',
    title: 'Voucher expirat curând!',
    body: `Voucherul ${voucherCode} expiră în ${daysLeft} zile. Folosește-l acum!`,
    data: { voucherCode, daysLeft },
  }),

  backInStock: (productName: string, productId: string): NotificationPayload => ({
    type: 'back_in_stock',
    title: 'Produsul este din nou în stoc!',
    body: `${productName} este din nou disponibil.`,
    data: { productId },
  }),

  priceDrop: (
    productName: string,
    productId: string,
    oldPrice: number,
    newPrice: number,
  ): NotificationPayload => ({
    type: 'price_drop',
    title: 'Preț redus!',
    body: `${productName} este acum la ${newPrice} RON (de la ${oldPrice} RON)!`,
    data: { productId, oldPrice, newPrice },
  }),
};

import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import {
  createDefaultUserSettings,
  createCommerceStore,
  createInMemoryCommerceStore,
  type Address,
  type AnalyticsEvent,
  type CommerceStore,
  type DeviceRegistration,
  type Notification,
  type UserSettings,
} from '../services/commerceStore.js';
import {
  AccountSettingsPatchSchema,
  ChangePasswordSchema,
  type AccountSettingsPatchInput,
} from '../schemas/validation.js';
import { getSessionContext, hashPassword, parseAddressDraft, verifyPassword } from './utils.js';

type AccountRoutesOptions = {
  store?: CommerceStore;
  firestore?: Firestore | null;
};

type ConsentPatch = {
  granted?: boolean | undefined;
  updatedAt?: string | undefined;
  source?: string | undefined;
};

const mergeConsent = (
  current: UserSettings['privacy']['analyticsConsent'],
  patch: ConsentPatch | undefined,
  now: string,
) => {
  if (!patch || typeof patch !== 'object') return current;
  const hasGranted = typeof patch.granted === 'boolean';
  const granted = typeof patch.granted === 'boolean' ? patch.granted : current.granted;
  const source =
    typeof patch.source === 'string' && patch.source.trim().length > 0
      ? patch.source.trim()
      : hasGranted
        ? 'account-settings'
        : current.source;
  const updatedAt =
    typeof patch.updatedAt === 'string' && patch.updatedAt.trim().length > 0
      ? patch.updatedAt.trim()
      : hasGranted && granted !== current.granted
        ? now
        : current.updatedAt;

  return { granted, source, updatedAt };
};

const mergeSettings = (
  current: UserSettings,
  patch: AccountSettingsPatchInput,
  fallbackDisplayName: string,
): UserSettings => {
  const now = new Date().toISOString();

  const merged: UserSettings = {
    notifications: {
      email: {
        marketing: patch.notifications?.email?.marketing ?? current.notifications.email.marketing,
        orderUpdates:
          patch.notifications?.email?.orderUpdates ?? current.notifications.email.orderUpdates,
        securityAlerts:
          patch.notifications?.email?.securityAlerts ?? current.notifications.email.securityAlerts,
      },
      push: {
        marketing: patch.notifications?.push?.marketing ?? current.notifications.push.marketing,
        orderUpdates:
          patch.notifications?.push?.orderUpdates ?? current.notifications.push.orderUpdates,
        securityAlerts:
          patch.notifications?.push?.securityAlerts ?? current.notifications.push.securityAlerts,
        backInStock:
          patch.notifications?.push?.backInStock ?? current.notifications.push.backInStock ?? true,
      },
      inApp: {
        marketing: patch.notifications?.inApp?.marketing ?? current.notifications.inApp.marketing,
        orderUpdates:
          patch.notifications?.inApp?.orderUpdates ?? current.notifications.inApp.orderUpdates,
        securityAlerts:
          patch.notifications?.inApp?.securityAlerts ?? current.notifications.inApp.securityAlerts,
      },
    },
    privacy: {
      analyticsConsent: mergeConsent(
        current.privacy.analyticsConsent,
        patch.privacy?.analyticsConsent,
        now,
      ),
      personalizationConsent: mergeConsent(
        current.privacy.personalizationConsent,
        patch.privacy?.personalizationConsent,
        now,
      ),
      marketingConsent: mergeConsent(
        current.privacy.marketingConsent,
        patch.privacy?.marketingConsent,
        now,
      ),
    },
    security: {
      loginAlerts: patch.security?.loginAlerts ?? current.security.loginAlerts,
      twoFactorEnabled: patch.security?.twoFactorEnabled ?? current.security.twoFactorEnabled,
    },
    profile: {
      displayName:
        (patch.profile?.displayName?.trim() ?? current.profile.displayName.trim()) ||
        fallbackDisplayName,
      locale: patch.profile?.locale?.trim() ?? current.profile.locale,
    },
    schemaVersion: Math.max(1, current.schemaVersion),
    updatedAt: now,
  };

  return merged;
};

const resolveSettingsWithFallback = (
  settings: UserSettings,
  fallbackDisplayName: string,
): UserSettings => {
  const displayName = settings.profile.displayName.trim() || fallbackDisplayName;
  return {
    ...settings,
    notifications: {
      email: { ...settings.notifications.email },
      push: { ...settings.notifications.push },
      inApp: { ...settings.notifications.inApp },
    },
    privacy: {
      analyticsConsent: { ...settings.privacy.analyticsConsent },
      personalizationConsent: { ...settings.privacy.personalizationConsent },
      marketingConsent: { ...settings.privacy.marketingConsent },
    },
    security: { ...settings.security },
    profile: { ...settings.profile, displayName },
    schemaVersion: Math.max(1, settings.schemaVersion),
  };
};

export const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (fastify, options) => {
  const store = options.store ?? (options.firestore ? createCommerceStore(options.firestore) : createInMemoryCommerceStore());

  fastify.get('/account/addresses', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const [addresses, selectedAddressId] = await Promise.all([
      store.getAddresses(sessionCtx.user.id),
      store.getSelectedAddressId(sessionCtx.user.id),
    ]);

    return { addresses, selectedAddressId };
  });

  fastify.post('/account/addresses', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const draft = parseAddressDraft(request.body);
    if (!draft) {
      reply.code(400);
      return { error: 'Invalid address payload.' };
    }

    const current = await store.getAddresses(sessionCtx.user.id);
    const now = new Date().toISOString();
    const address: Address = { id: randomUUID(), ...draft, createdAt: now, updatedAt: now };
    const next = [address, ...current];
    await store.setAddresses(sessionCtx.user.id, next);

    const selectedAddressId = await store.getSelectedAddressId(sessionCtx.user.id);
    if (!selectedAddressId) {
      await store.setSelectedAddressId(sessionCtx.user.id, address.id);
    }

    return { address, addresses: next, selectedAddressId: selectedAddressId ?? address.id };
  });

  fastify.put('/account/addresses/:addressId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { addressId?: string };
    const addressId = (params.addressId ?? '').trim();
    if (!addressId) {
      reply.code(400);
      return { error: 'Address id is required.' };
    }

    const draft = parseAddressDraft(request.body);
    if (!draft) {
      reply.code(400);
      return { error: 'Invalid address payload.' };
    }

    const current = await store.getAddresses(sessionCtx.user.id);
    const index = current.findIndex((item) => item.id === addressId);
    if (index < 0 || !current[index]) {
      reply.code(404);
      return { error: 'Address not found.' };
    }

    const existing = current[index];
    const updated: Address = {
      ...existing,
      ...draft,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const next = [...current];
    next[index] = updated;
    await store.setAddresses(sessionCtx.user.id, next);

    return {
      address: updated,
      addresses: next,
      selectedAddressId: await store.getSelectedAddressId(sessionCtx.user.id),
    };
  });

  fastify.delete('/account/addresses/:addressId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { addressId?: string };
    const addressId = (params.addressId ?? '').trim();
    if (!addressId) {
      reply.code(400);
      return { error: 'Address id is required.' };
    }

    const current = await store.getAddresses(sessionCtx.user.id);
    const next = current.filter((item) => item.id !== addressId);
    if (next.length === current.length) {
      reply.code(404);
      return { error: 'Address not found.' };
    }

    await store.setAddresses(sessionCtx.user.id, next);

    const selectedAddressId = await store.getSelectedAddressId(sessionCtx.user.id);
    if (selectedAddressId === addressId) {
      await store.setSelectedAddressId(sessionCtx.user.id, next[0]?.id ?? null);
    }

    return {
      ok: true,
      addresses: next,
      selectedAddressId: await store.getSelectedAddressId(sessionCtx.user.id),
    };
  });

  fastify.put('/account/addresses/selected', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const body = (request.body ?? {}) as { addressId?: string };
    const addressId = (body.addressId ?? '').trim();
    if (!addressId) {
      reply.code(400);
      return { error: 'Address id is required.' };
    }

    const addresses = await store.getAddresses(sessionCtx.user.id);
    if (!addresses.some((item) => item.id === addressId)) {
      reply.code(404);
      return { error: 'Address not found.' };
    }

    await store.setSelectedAddressId(sessionCtx.user.id, addressId);
    return { ok: true, selectedAddressId: addressId };
  });

  fastify.get('/account/settings', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const current = await store.getUserSettings(sessionCtx.user.id);
    const settings = resolveSettingsWithFallback(
      current,
      sessionCtx.user.name.trim() || createDefaultUserSettings().profile.displayName,
    );

    if (settings.profile.displayName !== current.profile.displayName) {
      await store.setUserSettings(sessionCtx.user.id, settings);
    }

    return { settings };
  });

  fastify.patch('/account/settings', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const parsed = AccountSettingsPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'Invalid account settings payload.',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    const current = resolveSettingsWithFallback(
      await store.getUserSettings(sessionCtx.user.id),
      sessionCtx.user.name.trim() || createDefaultUserSettings().profile.displayName,
    );
    const settings = mergeSettings(current, parsed.data, sessionCtx.user.name.trim());
    await store.setUserSettings(sessionCtx.user.id, settings);
    return { settings };
  });

  fastify.post('/account/security/change-password', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const parsed = ChangePasswordSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'Invalid password payload.',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      reply.code(400);
      return { error: 'New password must be different from current password.' };
    }

    if (!verifyPassword(currentPassword, sessionCtx.user.passwordHash ?? '')) {
      reply.code(401);
      return { error: 'Current password is incorrect.' };
    }

    const updated = await store.setUserPasswordHash(sessionCtx.user.id, hashPassword(newPassword));
    if (!updated) {
      reply.code(404);
      return { error: 'Account not found.' };
    }

    return { ok: true };
  });

  fastify.get('/wishlist', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }
    return { productIds: await store.getWishlist(sessionCtx.user.id) };
  });

  fastify.put('/wishlist/:productId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { productId: string };
    const body = (request.body ?? {}) as { active?: boolean };
    const active = body.active !== false;

    const set = new Set(await store.getWishlist(sessionCtx.user.id));
    if (active) {
      set.add(params.productId);
    } else {
      set.delete(params.productId);
    }
    const productIds = Array.from(set);
    await store.setWishlist(sessionCtx.user.id, productIds);

    return { productIds };
  });

  fastify.get('/catalog/back-in-stock/subscriptions', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }
    return { productIds: await store.getBackInStockSubscriptions(sessionCtx.user.id) };
  });

  fastify.put('/catalog/back-in-stock/:productId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { productId?: string };
    const productId = (params.productId ?? '').trim();
    if (!productId) {
      reply.code(400);
      return { error: 'Product id is required.' };
    }

    const body = (request.body ?? {}) as { active?: boolean };
    const active = body.active !== false;

    const set = new Set(await store.getBackInStockSubscriptions(sessionCtx.user.id));
    if (active) {
      set.add(productId);
    } else {
      set.delete(productId);
    }

    const productIds = Array.from(set);
    await store.setBackInStockSubscriptions(sessionCtx.user.id, productIds);

    return { productIds };
  });

  fastify.post('/analytics/events', async (request) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    const body = (request.body ?? {}) as {
      events?: Array<{ name?: string; payload?: Record<string, unknown>; timestamp?: string }>;
    };

    const events = body.events ?? [];
    const acceptedEvents: AnalyticsEvent[] = [];

    for (const event of events) {
      if (!event.name || event.name.trim().length === 0) continue;
      acceptedEvents.push({
        id: randomUUID(),
        ...(sessionCtx ? { userId: sessionCtx.user.id } : {}),
        name: event.name.trim(),
        payload: event.payload ?? {},
        timestamp: event.timestamp ?? new Date().toISOString(),
      });
    }

    await store.appendAnalytics(acceptedEvents);
    return { accepted: acceptedEvents.length };
  });

  fastify.post('/notifications/register', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const body = (request.body ?? {}) as {
      deviceId?: string;
      platform?: string;
      pushToken?: string;
    };
    const deviceId = (body.deviceId ?? '').trim();
    const platform = (body.platform ?? '').trim().toLowerCase() || 'mobile';
    const pushToken = (body.pushToken ?? '').trim();

    if (!body.deviceId || body.deviceId.trim().length < 6) {
      reply.code(400);
      return { error: 'Invalid device id.' };
    }

    const current = await store.getDeviceRegistrations(sessionCtx.user.id);
    const now = new Date().toISOString();
    const index = current.findIndex((item) => item.deviceId === deviceId);
    const next = [...current];

    if (index >= 0) {
      const existing = next[index] as DeviceRegistration;
      next[index] = {
        ...existing,
        deviceId,
        platform,
        pushToken: pushToken || existing.pushToken,
        lastSeenAt: now,
      };
    } else {
      next.push({
        id: randomUUID(),
        deviceId,
        platform,
        pushToken,
        createdAt: now,
        lastSeenAt: now,
      });
    }

    await store.setDeviceRegistrations(sessionCtx.user.id, next);
    return { ok: true, deviceCount: next.length, pushEnabled: pushToken.length > 0 };
  });

  fastify.get('/account/sessions', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const currentDeviceId =
      typeof request.headers['x-device-id'] === 'string'
        ? request.headers['x-device-id'].trim()
        : '';
    const sessions = await store.getDeviceRegistrations(sessionCtx.user.id);

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceId: session.deviceId,
        platform: session.platform,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        current: currentDeviceId.length > 0 && session.deviceId === currentDeviceId,
      })),
    };
  });

  fastify.delete('/account/sessions/:sessionId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { sessionId?: string };
    const sessionId = (params.sessionId ?? '').trim();
    if (!sessionId) {
      reply.code(400);
      return { error: 'Session id is required.' };
    }

    const current = await store.getDeviceRegistrations(sessionCtx.user.id);
    const next = current.filter((item) => item.id !== sessionId);

    if (next.length === current.length) {
      reply.code(404);
      return { error: 'Session not found.' };
    }

    await store.setDeviceRegistrations(sessionCtx.user.id, next);
    return {
      ok: true,
      sessions: next.map((session) => ({
        id: session.id,
        deviceId: session.deviceId,
        platform: session.platform,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
      })),
    };
  });

  fastify.get('/notifications/inbox', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }
    return { notifications: await store.getNotifications(sessionCtx.user.id) };
  });

  fastify.post('/notifications/read', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const body = (request.body ?? {}) as { notificationId?: string };
    const list = await store.getNotifications(sessionCtx.user.id);
    const next: Notification[] = list.map((item) =>
      item.id === body.notificationId
        ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
        : item,
    );
    await store.setNotifications(sessionCtx.user.id, next);

    return { ok: true };
  });
};

import { randomBytes, randomUUID } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

export type CommerceUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
};

export type CommerceSession = {
  token: string;
  userId: string;
  createdAt: string;
};

export type CartLine = {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceRon?: number;
};

export type Order = {
  id: string;
  userId: string;
  lines: CartLine[];
  totalRon: number;
  currency: string;
  status: OrderStatus;
  trackingCode?: string;
  carrier?: string;
  carrierService?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  checkoutUrl?: string;
  externalCheckoutId?: string;
  addressId?: string;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
};

export type OrderStatus =
  | 'created'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'cancelled';

export type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

export type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceRegistration = {
  id: string;
  deviceId: string;
  platform: string;
  pushToken: string;
  createdAt: string;
  lastSeenAt: string;
};

export type ConsentSetting = {
  granted: boolean;
  updatedAt: string;
  source: string;
};

export type NotificationChannelSettings = {
  marketing: boolean;
  orderUpdates: boolean;
  securityAlerts: boolean;
};

export type PushNotificationSettings = NotificationChannelSettings & {
  backInStock?: boolean;
};

export type UserSettings = {
  notifications: {
    email: NotificationChannelSettings;
    push: PushNotificationSettings;
    inApp: NotificationChannelSettings;
  };
  privacy: {
    analyticsConsent: ConsentSetting;
    personalizationConsent: ConsentSetting;
    marketingConsent: ConsentSetting;
  };
  security: {
    loginAlerts: boolean;
    twoFactorEnabled: boolean;
  };
  profile: {
    displayName: string;
    locale: string;
  };
  schemaVersion: number;
  updatedAt: string;
};

export type AnalyticsEvent = {
  id: string;
  userId?: string;
  name: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

export type LoyaltyProfile = {
  redeemedPoints: number;
  earnedPointsFromScans?: number;
  processedReceiptIds?: string[];
  redeemedVoucherCodes?: string[];
  loyaltyLedger?: LoyaltyLedgerEntry[];
  voucherHistory?: VoucherWalletEntry[];
  lastVoucherCode?: string;
  lastVoucherValueRon?: number;
  lastVoucherCreatedAt?: string;
  lastVoucherExpiresAt?: string;
  lastVoucherQrToken?: string;
  loyaltyQrToken?: string;
  loyaltyQrCreatedAt?: string;
};

export type VoucherWalletEntry = {
  code: string;
  valueRon: number;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired';
  usedAt?: string;
  receiptId?: string;
};

export type LoyaltyLedgerEntry = {
  id: string;
  kind: 'earn' | 'voucher-redeemed';
  pointsDelta: number;
  amountRon: number;
  receiptId: string;
  storeId?: string;
  terminalId?: string;
  createdAt: string;
};

export type CommerceStore = {
  getUserByEmail: (email: string) => Promise<CommerceUser | null>;
  getUserById: (id: string) => Promise<CommerceUser | null>;
  setUserPasswordHash: (userId: string, passwordHash: string) => Promise<boolean>;
  createUser: (input: {
    email: string;
    passwordHash: string;
    name: string;
  }) => Promise<CommerceUser>;
  createSession: (userId: string) => Promise<CommerceSession>;
  getSessionByToken: (token: string) => Promise<CommerceSession | null>;
  deleteSession: (token: string) => Promise<void>;
  getCart: (userId: string) => Promise<CartLine[]>;
  setCart: (userId: string, lines: CartLine[]) => Promise<void>;
  getOrders: (userId: string) => Promise<Order[]>;
  setOrders: (userId: string, orders: Order[]) => Promise<void>;
  getWishlist: (userId: string) => Promise<string[]>;
  setWishlist: (userId: string, productIds: string[]) => Promise<void>;
  getNotifications: (userId: string) => Promise<Notification[]>;
  setNotifications: (userId: string, notifications: Notification[]) => Promise<void>;
  getUserSettings: (userId: string) => Promise<UserSettings>;
  setUserSettings: (userId: string, settings: UserSettings) => Promise<void>;
  getAddresses: (userId: string) => Promise<Address[]>;
  setAddresses: (userId: string, addresses: Address[]) => Promise<void>;
  getSelectedAddressId: (userId: string) => Promise<string | null>;
  setSelectedAddressId: (userId: string, addressId: string | null) => Promise<void>;
  getDeviceRegistrations: (userId: string) => Promise<DeviceRegistration[]>;
  setDeviceRegistrations: (userId: string, registrations: DeviceRegistration[]) => Promise<void>;
  getBackInStockSubscriptions: (userId: string) => Promise<string[]>;
  setBackInStockSubscriptions: (userId: string, productIds: string[]) => Promise<void>;
  appendAnalytics: (events: AnalyticsEvent[]) => Promise<void>;
  getLoyaltyProfile: (userId: string) => Promise<LoyaltyProfile>;
  setLoyaltyProfile: (userId: string, profile: LoyaltyProfile) => Promise<void>;
};

const cloneLoyaltyLedger = (items: LoyaltyLedgerEntry[]) => items.map((item) => ({ ...item }));
const cloneVoucherHistory = (items: VoucherWalletEntry[]) => items.map((item) => ({ ...item }));
const cloneAddresses = (items: Address[]) => items.map((item) => ({ ...item }));
const cloneDeviceRegistrations = (items: DeviceRegistration[]) =>
  items.map((item) => ({ ...item }));
const cloneUserSettings = (settings: UserSettings): UserSettings => ({
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
  profile: { ...settings.profile },
  schemaVersion: settings.schemaVersion,
  updatedAt: settings.updatedAt,
});

const SETTINGS_SCHEMA_VERSION = 1;

const createConsentDefaults = (granted: boolean, source: string, now: string): ConsentSetting => ({
  granted,
  updatedAt: now,
  source,
});

export const createDefaultUserSettings = (): UserSettings => {
  const now = new Date().toISOString();
  return {
    notifications: {
      email: { marketing: true, orderUpdates: true, securityAlerts: true },
      push: { marketing: false, orderUpdates: true, securityAlerts: true, backInStock: true },
      inApp: { marketing: true, orderUpdates: true, securityAlerts: true },
    },
    privacy: {
      analyticsConsent: createConsentDefaults(false, 'system-default', now),
      personalizationConsent: createConsentDefaults(false, 'system-default', now),
      marketingConsent: createConsentDefaults(false, 'system-default', now),
    },
    security: { loginAlerts: true, twoFactorEnabled: false },
    profile: { displayName: '', locale: 'ro-RO' },
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    updatedAt: now,
  };
};

const normalizeBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const normalizeString = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const normalizeConsent = (value: unknown, fallback: ConsentSetting): ConsentSetting => {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    granted: normalizeBoolean(input.granted, fallback.granted),
    updatedAt: normalizeString(input.updatedAt, fallback.updatedAt),
    source: normalizeString(input.source, fallback.source),
  };
};

const normalizeUserSettings = (value: unknown): UserSettings => {
  const defaults = createDefaultUserSettings();
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const notificationsInput =
    input.notifications && typeof input.notifications === 'object'
      ? (input.notifications as Record<string, unknown>)
      : {};
  const emailInput =
    notificationsInput.email && typeof notificationsInput.email === 'object'
      ? (notificationsInput.email as Record<string, unknown>)
      : {};
  const pushInput =
    notificationsInput.push && typeof notificationsInput.push === 'object'
      ? (notificationsInput.push as Record<string, unknown>)
      : {};
  const inAppInput =
    notificationsInput.inApp && typeof notificationsInput.inApp === 'object'
      ? (notificationsInput.inApp as Record<string, unknown>)
      : {};

  const privacyInput =
    input.privacy && typeof input.privacy === 'object'
      ? (input.privacy as Record<string, unknown>)
      : {};
  const securityInput =
    input.security && typeof input.security === 'object'
      ? (input.security as Record<string, unknown>)
      : {};
  const profileInput =
    input.profile && typeof input.profile === 'object'
      ? (input.profile as Record<string, unknown>)
      : {};

  return {
    notifications: {
      email: {
        marketing: normalizeBoolean(emailInput.marketing, defaults.notifications.email.marketing),
        orderUpdates: normalizeBoolean(
          emailInput.orderUpdates,
          defaults.notifications.email.orderUpdates,
        ),
        securityAlerts: normalizeBoolean(
          emailInput.securityAlerts,
          defaults.notifications.email.securityAlerts,
        ),
      },
      push: {
        marketing: normalizeBoolean(pushInput.marketing, defaults.notifications.push.marketing),
        orderUpdates: normalizeBoolean(
          pushInput.orderUpdates,
          defaults.notifications.push.orderUpdates,
        ),
        securityAlerts: normalizeBoolean(
          pushInput.securityAlerts,
          defaults.notifications.push.securityAlerts,
        ),
        backInStock: normalizeBoolean(
          pushInput.backInStock,
          defaults.notifications.push.backInStock ?? true,
        ),
      },
      inApp: {
        marketing: normalizeBoolean(inAppInput.marketing, defaults.notifications.inApp.marketing),
        orderUpdates: normalizeBoolean(
          inAppInput.orderUpdates,
          defaults.notifications.inApp.orderUpdates,
        ),
        securityAlerts: normalizeBoolean(
          inAppInput.securityAlerts,
          defaults.notifications.inApp.securityAlerts,
        ),
      },
    },
    privacy: {
      analyticsConsent: normalizeConsent(
        privacyInput.analyticsConsent,
        defaults.privacy.analyticsConsent,
      ),
      personalizationConsent: normalizeConsent(
        privacyInput.personalizationConsent,
        defaults.privacy.personalizationConsent,
      ),
      marketingConsent: normalizeConsent(
        privacyInput.marketingConsent,
        defaults.privacy.marketingConsent,
      ),
    },
    security: {
      loginAlerts: normalizeBoolean(securityInput.loginAlerts, defaults.security.loginAlerts),
      twoFactorEnabled: normalizeBoolean(
        securityInput.twoFactorEnabled,
        defaults.security.twoFactorEnabled,
      ),
    },
    profile: {
      displayName:
        typeof profileInput.displayName === 'string' ? profileInput.displayName.trim() : '',
      locale: normalizeString(profileInput.locale, defaults.profile.locale),
    },
    schemaVersion:
      typeof input.schemaVersion === 'number' && Number.isFinite(input.schemaVersion)
        ? Math.max(SETTINGS_SCHEMA_VERSION, Math.floor(input.schemaVersion))
        : SETTINGS_SCHEMA_VERSION,
    updatedAt: normalizeString(input.updatedAt, defaults.updatedAt),
  };
};

const cloneLoyaltyProfile = (profile: LoyaltyProfile): LoyaltyProfile => ({
  ...profile,
  ...(Array.isArray(profile.processedReceiptIds)
    ? { processedReceiptIds: [...profile.processedReceiptIds] }
    : {}),
  ...(Array.isArray(profile.redeemedVoucherCodes)
    ? { redeemedVoucherCodes: [...profile.redeemedVoucherCodes] }
    : {}),
  ...(Array.isArray(profile.loyaltyLedger)
    ? { loyaltyLedger: cloneLoyaltyLedger(profile.loyaltyLedger) }
    : {}),
  ...(Array.isArray(profile.voucherHistory)
    ? { voucherHistory: cloneVoucherHistory(profile.voucherHistory) }
    : {}),
});

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Timed out after ${ms}ms: ${label}`));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

class InMemoryCommerceStore implements CommerceStore {
  private readonly usersById = new Map<string, CommerceUser>();
  private readonly usersByEmail = new Map<string, CommerceUser>();
  private readonly sessionsByToken = new Map<string, CommerceSession>();
  private readonly cartsByUserId = new Map<string, CartLine[]>();
  private readonly ordersByUserId = new Map<string, Order[]>();
  private readonly wishlistByUserId = new Map<string, Set<string>>();
  private readonly notificationsByUserId = new Map<string, Notification[]>();
  private readonly settingsByUserId = new Map<string, UserSettings>();
  private readonly addressesByUserId = new Map<string, Address[]>();
  private readonly selectedAddressByUserId = new Map<string, string | null>();
  private readonly devicesByUserId = new Map<string, DeviceRegistration[]>();
  private readonly backInStockByUserId = new Map<string, Set<string>>();
  private readonly analyticsEvents: AnalyticsEvent[] = [];
  private readonly loyaltyByUserId = new Map<string, LoyaltyProfile>();

  async getUserByEmail(email: string): Promise<CommerceUser | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async getUserById(id: string): Promise<CommerceUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async setUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const existing = this.usersById.get(userId);
    if (!existing) return false;
    const next: CommerceUser = { ...existing, passwordHash };
    this.usersById.set(userId, next);
    this.usersByEmail.set(next.email, next);
    return true;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<CommerceUser> {
    const user: CommerceUser = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      createdAt: new Date().toISOString(),
    };

    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  async createSession(userId: string): Promise<CommerceSession> {
    const session: CommerceSession = {
      token: randomBytes(24).toString('hex'),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.sessionsByToken.set(session.token, session);
    return session;
  }

  async getSessionByToken(token: string): Promise<CommerceSession | null> {
    return this.sessionsByToken.get(token) ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessionsByToken.delete(token);
  }

  async getCart(userId: string): Promise<CartLine[]> {
    return (this.cartsByUserId.get(userId) ?? []).map((line) => ({ ...line }));
  }

  async setCart(userId: string, lines: CartLine[]): Promise<void> {
    this.cartsByUserId.set(
      userId,
      lines.map((line) => ({ ...line })),
    );
  }

  async getOrders(userId: string): Promise<Order[]> {
    return (this.ordersByUserId.get(userId) ?? []).map((order) => ({
      ...order,
      lines: order.lines.map((line) => ({ ...line })),
    }));
  }

  async setOrders(userId: string, orders: Order[]): Promise<void> {
    this.ordersByUserId.set(
      userId,
      orders.map((order) => ({
        ...order,
        lines: order.lines.map((line) => ({ ...line })),
      })),
    );
  }

  async getWishlist(userId: string): Promise<string[]> {
    return Array.from(this.wishlistByUserId.get(userId) ?? new Set<string>());
  }

  async setWishlist(userId: string, productIds: string[]): Promise<void> {
    this.wishlistByUserId.set(userId, new Set(productIds));
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return (this.notificationsByUserId.get(userId) ?? []).map((item) => ({ ...item }));
  }

  async setNotifications(userId: string, notifications: Notification[]): Promise<void> {
    this.notificationsByUserId.set(
      userId,
      notifications.map((item) => ({ ...item })),
    );
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    const current = this.settingsByUserId.get(userId);
    return current ? cloneUserSettings(current) : createDefaultUserSettings();
  }

  async setUserSettings(userId: string, settings: UserSettings): Promise<void> {
    this.settingsByUserId.set(userId, cloneUserSettings(normalizeUserSettings(settings)));
  }

  async getAddresses(userId: string): Promise<Address[]> {
    return cloneAddresses(this.addressesByUserId.get(userId) ?? []);
  }

  async setAddresses(userId: string, addresses: Address[]): Promise<void> {
    this.addressesByUserId.set(userId, cloneAddresses(addresses));
  }

  async getSelectedAddressId(userId: string): Promise<string | null> {
    return this.selectedAddressByUserId.get(userId) ?? null;
  }

  async setSelectedAddressId(userId: string, addressId: string | null): Promise<void> {
    this.selectedAddressByUserId.set(userId, addressId);
  }

  async getDeviceRegistrations(userId: string): Promise<DeviceRegistration[]> {
    return cloneDeviceRegistrations(this.devicesByUserId.get(userId) ?? []);
  }

  async setDeviceRegistrations(userId: string, registrations: DeviceRegistration[]): Promise<void> {
    this.devicesByUserId.set(userId, cloneDeviceRegistrations(registrations));
  }

  async getBackInStockSubscriptions(userId: string): Promise<string[]> {
    return Array.from(this.backInStockByUserId.get(userId) ?? new Set<string>());
  }

  async setBackInStockSubscriptions(userId: string, productIds: string[]): Promise<void> {
    this.backInStockByUserId.set(
      userId,
      new Set(productIds.filter((value) => typeof value === 'string' && value.trim().length > 0)),
    );
  }

  async appendAnalytics(events: AnalyticsEvent[]): Promise<void> {
    this.analyticsEvents.push(...events);
    if (this.analyticsEvents.length > 2000) {
      this.analyticsEvents.splice(0, this.analyticsEvents.length - 2000);
    }
  }

  async getLoyaltyProfile(userId: string): Promise<LoyaltyProfile> {
    const profile = this.loyaltyByUserId.get(userId);
    return profile ? cloneLoyaltyProfile(profile) : { redeemedPoints: 0 };
  }

  async setLoyaltyProfile(userId: string, profile: LoyaltyProfile): Promise<void> {
    this.loyaltyByUserId.set(userId, cloneLoyaltyProfile(profile));
  }
}

class FirestoreCommerceStore implements CommerceStore {
  constructor(private readonly db: Firestore) {}

  async getUserByEmail(email: string): Promise<CommerceUser | null> {
    const snapshot = await this.db
      .collection('commerce_users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const first = snapshot.docs[0];
    if (!first) return null;
    return first.data() as CommerceUser;
  }

  async getUserById(id: string): Promise<CommerceUser | null> {
    const doc = await this.db.collection('commerce_users').doc(id).get();
    return doc.exists ? (doc.data() as CommerceUser) : null;
  }

  async setUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const ref = this.db.collection('commerce_users').doc(userId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.set({ passwordHash }, { merge: true });
    return true;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<CommerceUser> {
    const user: CommerceUser = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      createdAt: new Date().toISOString(),
    };
    await this.db.collection('commerce_users').doc(user.id).set(user);
    return user;
  }

  async createSession(userId: string): Promise<CommerceSession> {
    const session: CommerceSession = {
      token: randomBytes(24).toString('hex'),
      userId,
      createdAt: new Date().toISOString(),
    };
    await this.db.collection('commerce_sessions').doc(session.token).set(session);
    return session;
  }

  async getSessionByToken(token: string): Promise<CommerceSession | null> {
    const doc = await this.db.collection('commerce_sessions').doc(token).get();
    return doc.exists ? (doc.data() as CommerceSession) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.collection('commerce_sessions').doc(token).delete();
  }

  async getCart(userId: string): Promise<CartLine[]> {
    const doc = await this.db.collection('commerce_carts').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { lines?: CartLine[] };
    return Array.isArray(data.lines) ? data.lines : [];
  }

  async setCart(userId: string, lines: CartLine[]): Promise<void> {
    await this.db.collection('commerce_carts').doc(userId).set({ lines });
  }

  async getOrders(userId: string): Promise<Order[]> {
    const doc = await this.db.collection('commerce_orders').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { items?: Order[] };
    return Array.isArray(data.items) ? data.items : [];
  }

  async setOrders(userId: string, orders: Order[]): Promise<void> {
    await this.db.collection('commerce_orders').doc(userId).set({ items: orders });
  }

  async getWishlist(userId: string): Promise<string[]> {
    const doc = await this.db.collection('commerce_wishlists').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { productIds?: string[] };
    return Array.isArray(data.productIds) ? data.productIds : [];
  }

  async setWishlist(userId: string, productIds: string[]): Promise<void> {
    await this.db.collection('commerce_wishlists').doc(userId).set({ productIds });
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const doc = await this.db.collection('commerce_notifications').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { items?: Notification[] };
    return Array.isArray(data.items) ? data.items : [];
  }

  async setNotifications(userId: string, notifications: Notification[]): Promise<void> {
    await this.db.collection('commerce_notifications').doc(userId).set({ items: notifications });
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    const doc = await this.db.collection('commerce_user_settings').doc(userId).get();
    if (!doc.exists) return createDefaultUserSettings();
    return normalizeUserSettings(doc.data());
  }

  async setUserSettings(userId: string, settings: UserSettings): Promise<void> {
    await this.db
      .collection('commerce_user_settings')
      .doc(userId)
      .set(cloneUserSettings(normalizeUserSettings(settings)));
  }

  async getAddresses(userId: string): Promise<Address[]> {
    const doc = await this.db.collection('commerce_addresses').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { items?: Address[] };
    return Array.isArray(data.items) ? data.items : [];
  }

  async setAddresses(userId: string, addresses: Address[]): Promise<void> {
    const current = await this.db.collection('commerce_addresses').doc(userId).get();
    const selectedId =
      current.exists &&
      typeof (current.data() as { selectedId?: string | null }).selectedId !== 'undefined'
        ? ((current.data() as { selectedId?: string | null }).selectedId ?? null)
        : null;
    await this.db
      .collection('commerce_addresses')
      .doc(userId)
      .set({ items: cloneAddresses(addresses), selectedId });
  }

  async getSelectedAddressId(userId: string): Promise<string | null> {
    const doc = await this.db.collection('commerce_addresses').doc(userId).get();
    if (!doc.exists) return null;
    const data = doc.data() as { selectedId?: string | null };
    return typeof data.selectedId === 'string' ? data.selectedId : null;
  }

  async setSelectedAddressId(userId: string, addressId: string | null): Promise<void> {
    const current = await this.db.collection('commerce_addresses').doc(userId).get();
    const items =
      current.exists && Array.isArray((current.data() as { items?: Address[] }).items)
        ? ((current.data() as { items?: Address[] }).items ?? [])
        : [];
    await this.db
      .collection('commerce_addresses')
      .doc(userId)
      .set({ items, selectedId: addressId ?? null });
  }

  async getDeviceRegistrations(userId: string): Promise<DeviceRegistration[]> {
    const doc = await this.db.collection('commerce_devices').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { items?: DeviceRegistration[] };
    return Array.isArray(data.items) ? data.items : [];
  }

  async setDeviceRegistrations(userId: string, registrations: DeviceRegistration[]): Promise<void> {
    await this.db
      .collection('commerce_devices')
      .doc(userId)
      .set({ items: cloneDeviceRegistrations(registrations) });
  }

  async getBackInStockSubscriptions(userId: string): Promise<string[]> {
    const doc = await this.db.collection('commerce_back_in_stock').doc(userId).get();
    if (!doc.exists) return [];
    const data = doc.data() as { productIds?: string[] };
    return Array.isArray(data.productIds)
      ? data.productIds.filter((value) => typeof value === 'string' && value.length > 0)
      : [];
  }

  async setBackInStockSubscriptions(userId: string, productIds: string[]): Promise<void> {
    await this.db
      .collection('commerce_back_in_stock')
      .doc(userId)
      .set({
        productIds: productIds.filter(
          (value) => typeof value === 'string' && value.trim().length > 0,
        ),
      });
  }

  async appendAnalytics(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;
    const batch = this.db.batch();
    events.forEach((event) => {
      const ref = this.db.collection('commerce_analytics').doc(event.id);
      batch.set(ref, event);
    });
    await batch.commit();
  }

  async getLoyaltyProfile(userId: string): Promise<LoyaltyProfile> {
    const doc = await this.db.collection('commerce_loyalty').doc(userId).get();
    if (!doc.exists) return { redeemedPoints: 0 };
    const data = doc.data() as LoyaltyProfile | undefined;
    return {
      redeemedPoints: typeof data?.redeemedPoints === 'number' ? data.redeemedPoints : 0,
      ...(typeof data?.earnedPointsFromScans === 'number'
        ? { earnedPointsFromScans: data.earnedPointsFromScans }
        : {}),
      ...(Array.isArray(data?.processedReceiptIds)
        ? {
            processedReceiptIds: data?.processedReceiptIds.filter(
              (value): value is string => typeof value === 'string' && value.length > 0,
            ),
          }
        : {}),
      ...(Array.isArray(data?.redeemedVoucherCodes)
        ? {
            redeemedVoucherCodes: data?.redeemedVoucherCodes.filter(
              (value): value is string => typeof value === 'string' && value.length > 0,
            ),
          }
        : {}),
      ...(Array.isArray(data?.loyaltyLedger)
        ? {
            loyaltyLedger: data.loyaltyLedger
              .filter((entry): entry is LoyaltyLedgerEntry => !!entry && typeof entry === 'object')
              .map((entry) => ({
                id: entry.id,
                kind: entry.kind,
                pointsDelta: entry.pointsDelta,
                amountRon: entry.amountRon,
                receiptId: entry.receiptId,
                ...(entry.storeId ? { storeId: entry.storeId } : {}),
                ...(entry.terminalId ? { terminalId: entry.terminalId } : {}),
                createdAt: entry.createdAt,
              })),
          }
        : {}),
      ...(Array.isArray(data?.voucherHistory)
        ? {
            voucherHistory: data.voucherHistory
              .filter((entry): entry is VoucherWalletEntry => !!entry && typeof entry === 'object')
              .map((entry) => ({
                code: entry.code,
                valueRon: entry.valueRon,
                createdAt: entry.createdAt,
                expiresAt: entry.expiresAt,
                status: entry.status,
                ...(entry.usedAt ? { usedAt: entry.usedAt } : {}),
                ...(entry.receiptId ? { receiptId: entry.receiptId } : {}),
              })),
          }
        : {}),
      ...(data?.lastVoucherCode ? { lastVoucherCode: data.lastVoucherCode } : {}),
      ...(typeof data?.lastVoucherValueRon === 'number'
        ? { lastVoucherValueRon: data.lastVoucherValueRon }
        : {}),
      ...(data?.lastVoucherCreatedAt ? { lastVoucherCreatedAt: data.lastVoucherCreatedAt } : {}),
      ...(data?.lastVoucherExpiresAt ? { lastVoucherExpiresAt: data.lastVoucherExpiresAt } : {}),
      ...(data?.lastVoucherQrToken ? { lastVoucherQrToken: data.lastVoucherQrToken } : {}),
      ...(data?.loyaltyQrToken ? { loyaltyQrToken: data.loyaltyQrToken } : {}),
      ...(data?.loyaltyQrCreatedAt ? { loyaltyQrCreatedAt: data.loyaltyQrCreatedAt } : {}),
    };
  }

  async setLoyaltyProfile(userId: string, profile: LoyaltyProfile): Promise<void> {
    await this.db.collection('commerce_loyalty').doc(userId).set(cloneLoyaltyProfile(profile));
  }
}

class StrictCommerceStore implements CommerceStore {
  constructor(
    private readonly primary: CommerceStore,
    private readonly operationTimeoutMs = 4500,
  ) {}

  private run<T>(label: string, primaryOp: () => Promise<T>): Promise<T> {
    return withTimeout(primaryOp(), this.operationTimeoutMs, label);
  }

  async getUserByEmail(email: string): Promise<CommerceUser | null> {
    return this.run('getUserByEmail', () => this.primary.getUserByEmail(email));
  }

  async getUserById(id: string): Promise<CommerceUser | null> {
    return this.run('getUserById', () => this.primary.getUserById(id));
  }

  async setUserPasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    return this.run('setUserPasswordHash', () =>
      this.primary.setUserPasswordHash(userId, passwordHash),
    );
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<CommerceUser> {
    return this.run('createUser', () => this.primary.createUser(input));
  }

  async createSession(userId: string): Promise<CommerceSession> {
    return this.run('createSession', () => this.primary.createSession(userId));
  }

  async getSessionByToken(token: string): Promise<CommerceSession | null> {
    return this.run('getSessionByToken', () => this.primary.getSessionByToken(token));
  }

  async deleteSession(token: string): Promise<void> {
    return this.run('deleteSession', () => this.primary.deleteSession(token));
  }

  async getCart(userId: string): Promise<CartLine[]> {
    return this.run('getCart', () => this.primary.getCart(userId));
  }

  async setCart(userId: string, lines: CartLine[]): Promise<void> {
    return this.run('setCart', () => this.primary.setCart(userId, lines));
  }

  async getOrders(userId: string): Promise<Order[]> {
    return this.run('getOrders', () => this.primary.getOrders(userId));
  }

  async setOrders(userId: string, orders: Order[]): Promise<void> {
    return this.run('setOrders', () => this.primary.setOrders(userId, orders));
  }

  async getWishlist(userId: string): Promise<string[]> {
    return this.run('getWishlist', () => this.primary.getWishlist(userId));
  }

  async setWishlist(userId: string, productIds: string[]): Promise<void> {
    return this.run('setWishlist', () => this.primary.setWishlist(userId, productIds));
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.run('getNotifications', () => this.primary.getNotifications(userId));
  }

  async setNotifications(userId: string, notifications: Notification[]): Promise<void> {
    return this.run('setNotifications', () => this.primary.setNotifications(userId, notifications));
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    return this.run('getUserSettings', () => this.primary.getUserSettings(userId));
  }

  async setUserSettings(userId: string, settings: UserSettings): Promise<void> {
    return this.run('setUserSettings', () => this.primary.setUserSettings(userId, settings));
  }

  async getAddresses(userId: string): Promise<Address[]> {
    return this.run('getAddresses', () => this.primary.getAddresses(userId));
  }

  async setAddresses(userId: string, addresses: Address[]): Promise<void> {
    return this.run('setAddresses', () => this.primary.setAddresses(userId, addresses));
  }

  async getSelectedAddressId(userId: string): Promise<string | null> {
    return this.run('getSelectedAddressId', () => this.primary.getSelectedAddressId(userId));
  }

  async setSelectedAddressId(userId: string, addressId: string | null): Promise<void> {
    return this.run('setSelectedAddressId', () =>
      this.primary.setSelectedAddressId(userId, addressId),
    );
  }

  async getDeviceRegistrations(userId: string): Promise<DeviceRegistration[]> {
    return this.run('getDeviceRegistrations', () => this.primary.getDeviceRegistrations(userId));
  }

  async setDeviceRegistrations(userId: string, registrations: DeviceRegistration[]): Promise<void> {
    return this.run('setDeviceRegistrations', () =>
      this.primary.setDeviceRegistrations(userId, registrations),
    );
  }

  async getBackInStockSubscriptions(userId: string): Promise<string[]> {
    return this.run('getBackInStockSubscriptions', () =>
      this.primary.getBackInStockSubscriptions(userId),
    );
  }

  async setBackInStockSubscriptions(userId: string, productIds: string[]): Promise<void> {
    return this.run('setBackInStockSubscriptions', () =>
      this.primary.setBackInStockSubscriptions(userId, productIds),
    );
  }

  async appendAnalytics(events: AnalyticsEvent[]): Promise<void> {
    return this.run('appendAnalytics', () => this.primary.appendAnalytics(events));
  }

  async getLoyaltyProfile(userId: string): Promise<LoyaltyProfile> {
    return this.run('getLoyaltyProfile', () => this.primary.getLoyaltyProfile(userId));
  }

  async setLoyaltyProfile(userId: string, profile: LoyaltyProfile): Promise<void> {
    return this.run('setLoyaltyProfile', () => this.primary.setLoyaltyProfile(userId, profile));
  }
}

export const createCommerceStore = (firestore: Firestore | null): CommerceStore => {
  if (!firestore) {
    throw new Error(
      'Firestore is required for commerce routes. Set FIREBASE_ENABLED=true and provide valid credentials.',
    );
  }

  return new StrictCommerceStore(new FirestoreCommerceStore(firestore));
};

export const createInMemoryCommerceStore = (): CommerceStore => new InMemoryCommerceStore();

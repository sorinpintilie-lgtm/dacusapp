import { apiRequest } from './apiClient';
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  type StoredSession,
} from './sessionStorage';
import {
  loginWithFirebase,
  registerWithFirebase,
  logoutFromFirebase,
  getCurrentFirebaseUser,
  getFirebaseIdToken,
  onFirebaseAuthChange,
  type FirebaseUser,
} from './firebaseAuth';
import { authenticateWithBiometric, isBiometricAvailable } from './biometric';
import {
  getCatalog as getCatalogFromFn,
  getCart as getCartFromFn,
  addToCart as addToCartToFn,
  removeFromCart as removeFromCartFromFn,
  getAddresses as getAddressesFromFn,
  addAddress as addAddressToFn,
  getOrders as getOrdersFromFn,
} from './functionsClient';
import type { CatalogProduct } from '../data/catalog';

type User = {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
};

const toStoredUser = (user: User): StoredSession['user'] => ({
  ...user,
  createdAt: user.createdAt || new Date().toISOString(),
});

export type CartLine = {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPriceRon?: number;
};

export type Order = {
  id: string;
  lines: CartLine[];
  totalRon: number;
  currency: string;
  status: 'created' | 'processing' | 'shipped';
  trackingCode?: string;
  checkoutUrl?: string;
  externalCheckoutId?: string;
  addressId?: string;
  createdAt: string;
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

export type AddressDraft = Pick<
  Address,
  | 'label'
  | 'fullName'
  | 'phone'
  | 'line1'
  | 'line2'
  | 'city'
  | 'county'
  | 'postalCode'
  | 'countryCode'
>;

export type CartValidationIssue = {
  lineKey: string;
  productId: string;
  variantId?: string;
  code:
    | 'invalid_product_id'
    | 'invalid_quantity'
    | 'product_not_found'
    | 'variant_not_found'
    | 'out_of_stock'
    | 'price_mismatch';
  message: string;
  messageRo: string;
  expectedUnitPriceRon?: number;
  providedUnitPriceRon?: number;
};

export type CartValidationResult = {
  ok: boolean;
  issues: CartValidationIssue[];
  lines: CartLine[];
  totalRon: number;
};

export type OrderDetailsPayload = {
  order: Order;
  address?: Address;
};

export type AddressesPayload = {
  addresses: Address[];
  selectedAddressId: string | null;
};

export type InboxNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

export type LoyaltySummary = {
  points: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
  nextTierSpendRon: number;
  voucherWallet?: {
    active: LoyaltyVoucherWalletEntry[];
    expiringSoon: LoyaltyVoucherWalletEntry[];
    used: LoyaltyVoucherWalletEntry[];
    expired: LoyaltyVoucherWalletEntry[];
  };
  lastVoucher?: {
    code: string;
    valueRon: number;
    createdAt?: string;
    expiresAt?: string;
    qrToken?: string;
  };
  loyaltyQrToken?: string;
  loyaltyQrCreatedAt?: string;
};

export type LoyaltyVoucherWalletEntry = {
  code: string;
  valueRon: number;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired';
  usedAt?: string;
  receiptId?: string;
};

export type LoyaltyVoucher = {
  code: string;
  valueRon: number;
  pointsRedeemed: number;
  createdAt: string;
  expiresAt: string;
  qrToken?: string;
};

const normalizeLoyaltyTier = (value: unknown): LoyaltySummary['tier'] => {
  if (value === 'Gold' || value === 'Silver' || value === 'Bronze') return value;
  return 'Bronze';
};

const normalizeLoyaltyVoucherWalletEntry = (value: unknown): LoyaltyVoucherWalletEntry | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<LoyaltyVoucherWalletEntry>;
  if (typeof candidate.code !== 'string' || candidate.code.length === 0) return null;
  if (typeof candidate.valueRon !== 'number' || !Number.isFinite(candidate.valueRon)) return null;
  if (typeof candidate.createdAt !== 'string' || candidate.createdAt.length === 0) return null;
  if (typeof candidate.expiresAt !== 'string' || candidate.expiresAt.length === 0) return null;
  if (
    candidate.status !== 'active' &&
    candidate.status !== 'used' &&
    candidate.status !== 'expired'
  )
    return null;

  return {
    code: candidate.code,
    valueRon: candidate.valueRon,
    createdAt: candidate.createdAt,
    expiresAt: candidate.expiresAt,
    status: candidate.status,
    ...(typeof candidate.usedAt === 'string' && candidate.usedAt.length > 0
      ? { usedAt: candidate.usedAt }
      : {}),
    ...(typeof candidate.receiptId === 'string' && candidate.receiptId.length > 0
      ? { receiptId: candidate.receiptId }
      : {}),
  };
};

const normalizeLoyaltyVoucher = (value: unknown): LoyaltyVoucher => {
  if (!value || typeof value !== 'object') {
    return {
      code: 'N/A',
      valueRon: 0,
      pointsRedeemed: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
  }

  const candidate = value as Partial<LoyaltyVoucher>;
  return {
    code: typeof candidate.code === 'string' && candidate.code.length > 0 ? candidate.code : 'N/A',
    valueRon:
      typeof candidate.valueRon === 'number' && Number.isFinite(candidate.valueRon)
        ? candidate.valueRon
        : 0,
    pointsRedeemed:
      typeof candidate.pointsRedeemed === 'number' && Number.isFinite(candidate.pointsRedeemed)
        ? candidate.pointsRedeemed
        : 0,
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt.length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
    expiresAt:
      typeof candidate.expiresAt === 'string' && candidate.expiresAt.length > 0
        ? candidate.expiresAt
        : new Date().toISOString(),
    ...(typeof candidate.qrToken === 'string' && candidate.qrToken.length > 0
      ? { qrToken: candidate.qrToken }
      : {}),
  };
};

const normalizeLoyaltySummary = (value: unknown): LoyaltySummary => {
  if (!value || typeof value !== 'object') {
    return {
      points: 0,
      tier: 'Bronze',
      nextTierSpendRon: 1500,
    };
  }

  const candidate = value as Partial<LoyaltySummary>;
  const points =
    typeof candidate.points === 'number' && Number.isFinite(candidate.points)
      ? candidate.points
      : 0;
  const nextTierSpendRon =
    typeof candidate.nextTierSpendRon === 'number' && Number.isFinite(candidate.nextTierSpendRon)
      ? candidate.nextTierSpendRon
      : 1500;

  const voucherWallet =
    candidate.voucherWallet && typeof candidate.voucherWallet === 'object'
      ? {
          active: Array.isArray(candidate.voucherWallet.active)
            ? candidate.voucherWallet.active
                .map((item) => normalizeLoyaltyVoucherWalletEntry(item))
                .filter((item): item is LoyaltyVoucherWalletEntry => !!item)
            : [],
          expiringSoon: Array.isArray(candidate.voucherWallet.expiringSoon)
            ? candidate.voucherWallet.expiringSoon
                .map((item) => normalizeLoyaltyVoucherWalletEntry(item))
                .filter((item): item is LoyaltyVoucherWalletEntry => !!item)
            : [],
          used: Array.isArray(candidate.voucherWallet.used)
            ? candidate.voucherWallet.used
                .map((item) => normalizeLoyaltyVoucherWalletEntry(item))
                .filter((item): item is LoyaltyVoucherWalletEntry => !!item)
            : [],
          expired: Array.isArray(candidate.voucherWallet.expired)
            ? candidate.voucherWallet.expired
                .map((item) => normalizeLoyaltyVoucherWalletEntry(item))
                .filter((item): item is LoyaltyVoucherWalletEntry => !!item)
            : [],
        }
      : undefined;

  const lastVoucher =
    candidate.lastVoucher && typeof candidate.lastVoucher === 'object'
      ? {
          code:
            typeof candidate.lastVoucher.code === 'string' && candidate.lastVoucher.code.length > 0
              ? candidate.lastVoucher.code
              : 'N/A',
          valueRon:
            typeof candidate.lastVoucher.valueRon === 'number' &&
            Number.isFinite(candidate.lastVoucher.valueRon)
              ? candidate.lastVoucher.valueRon
              : 0,
          ...(typeof candidate.lastVoucher.createdAt === 'string' &&
          candidate.lastVoucher.createdAt.length > 0
            ? { createdAt: candidate.lastVoucher.createdAt }
            : {}),
          ...(typeof candidate.lastVoucher.expiresAt === 'string' &&
          candidate.lastVoucher.expiresAt.length > 0
            ? { expiresAt: candidate.lastVoucher.expiresAt }
            : {}),
          ...(typeof candidate.lastVoucher.qrToken === 'string' &&
          candidate.lastVoucher.qrToken.length > 0
            ? { qrToken: candidate.lastVoucher.qrToken }
            : {}),
        }
      : undefined;

  return {
    points,
    tier: normalizeLoyaltyTier(candidate.tier),
    nextTierSpendRon,
    ...(voucherWallet ? { voucherWallet } : {}),
    ...(lastVoucher ? { lastVoucher } : {}),
    ...(typeof candidate.loyaltyQrToken === 'string' && candidate.loyaltyQrToken.length > 0
      ? { loyaltyQrToken: candidate.loyaltyQrToken }
      : {}),
    ...(typeof candidate.loyaltyQrCreatedAt === 'string' && candidate.loyaltyQrCreatedAt.length > 0
      ? { loyaltyQrCreatedAt: candidate.loyaltyQrCreatedAt }
      : {}),
  };
};

export type SearchFacet = {
  field_name: string;
  counts: Array<{ value: string; count: number }>;
};

export type DeviceSession = {
  id: string;
  deviceId: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  current?: boolean;
};

export type AccountSettingsConsent = {
  granted: boolean;
  updatedAt: string;
  source: string;
};

export type AccountSettings = {
  schemaVersion: number;
  updatedAt: string;
  profile: {
    displayName: string;
    locale: string;
  };
  notifications: {
    email: {
      marketing: boolean;
      orderUpdates: boolean;
      securityAlerts: boolean;
    };
    push: {
      marketing: boolean;
      orderUpdates: boolean;
      securityAlerts: boolean;
      backInStock: boolean;
    };
    inApp: {
      marketing: boolean;
      orderUpdates: boolean;
      securityAlerts: boolean;
    };
  };
  privacy: {
    analyticsConsent: AccountSettingsConsent;
    personalizationConsent: AccountSettingsConsent;
    marketingConsent: AccountSettingsConsent;
  };
  security: {
    loginAlerts: boolean;
    twoFactorEnabled: boolean;
  };
};

export type AccountSettingsPatch = {
  profile?: Partial<AccountSettings['profile']>;
  notifications?: {
    email?: Partial<AccountSettings['notifications']['email']>;
    push?: Partial<AccountSettings['notifications']['push']>;
    inApp?: Partial<AccountSettings['notifications']['inApp']>;
  };
  privacy?: {
    analyticsConsent?: Partial<Pick<AccountSettingsConsent, 'granted' | 'source'>>;
    personalizationConsent?: Partial<Pick<AccountSettingsConsent, 'granted' | 'source'>>;
    marketingConsent?: Partial<Pick<AccountSettingsConsent, 'granted' | 'source'>>;
  };
  security?: Partial<AccountSettings['security']>;
};

export type ProductSearchPayload = {
  products: CatalogProduct[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  facets: SearchFacet[];
  source?: string;
};

const asSession = (payload: { idToken: string; user: User }): StoredSession => ({
  sessionToken: payload.idToken,
  user: toStoredUser(payload.user),
});

export const registerAccount = async (
  email: string,
  password: string,
  name: string,
): Promise<User> => {
  const { userId, email: e, idToken } = await registerWithFirebase(email, password, name);
  const user: User = { id: userId, email: e, name, createdAt: new Date().toISOString() };
  await setStoredSession(asSession({ idToken, user }));
  return user;
};

export const loginAccount = async (email: string, password: string): Promise<User> => {
  const { userId, email: e, idToken, name } = await loginWithFirebase(email, password);
  const user: User = { id: userId, email: e, name, createdAt: new Date().toISOString() };
  await setStoredSession(asSession({ idToken, user }));
  return user;
};

export const logoutAccount = async (): Promise<void> => {
  await logoutFromFirebase();
};

export const restoreAccount = async (): Promise<User | null> => {
  const firebaseUser = getCurrentFirebaseUser();
  if (!firebaseUser) return null;

  try {
    const idToken = await firebaseUser.getIdToken(true);
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Client',
    };
    await setStoredSession(asSession({ idToken, user }));
    return user;
  } catch (error) {
    console.log('[Auth] Firebase restore failed', error);
    return null;
  }
};

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  return onFirebaseAuthChange((firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Client',
    };
    callback(user);
  });
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  await apiRequest('/auth/reset-password-request', { method: 'POST', body: { email } });
};

export const fetchCart = async (): Promise<CartLine[]> => {
  try {
    return await getCartFromFn();
  } catch {
    const payload = await apiRequest<{ lines: CartLine[] }>('/cart', { auth: true });
    return payload.lines;
  }
};

export const upsertCartLine = async (line: CartLine): Promise<CartLine[]> => {
  try {
    return await addToCartToFn(line);
  } catch {
    const payload = await apiRequest<{ lines: CartLine[] }>('/cart/lines', {
      method: 'PUT',
      auth: true,
      body: line,
    });
    return payload.lines;
  }
};

export const replaceCartLines = async (lines: CartLine[]): Promise<CartLine[]> => {
  try {
    const { replaceCart } = await import('./functionsClient');
    return await replaceCart({ lines });
  } catch {
    const payload = await apiRequest<{ lines: CartLine[] }>('/cart/replace', {
      method: 'PUT',
      auth: true,
      body: { lines },
    });
    return payload.lines;
  }
};

export const removeCartLine = async (
  productId: string,
  variantId?: string,
): Promise<CartLine[]> => {
  try {
    return await removeFromCartFromFn(productId, variantId);
  } catch {
    const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    const payload = await apiRequest<{ lines: CartLine[] }>(
      `/cart/lines/${encodeURIComponent(productId)}${query}`,
      {
        method: 'DELETE',
        auth: true,
      },
    );
    return payload.lines;
  }
};

export const validateCart = async (): Promise<CartValidationResult> => {
  return apiRequest('/cart/validate', {
    method: 'POST',
    auth: true,
  });
};

export const checkoutCart = async (input?: {
  addressId?: string;
  address?: AddressDraft;
}): Promise<{
  orderId: string;
  checkoutUrl: string;
  trackingCode?: string;
  totalRon: number;
  currency: string;
  notifiedDevices?: number;
}> => {
  return apiRequest('/cart/checkout', {
    method: 'POST',
    auth: true,
    body: {
      currency: 'RON',
      ...(input?.addressId ? { addressId: input.addressId } : {}),
      ...(input?.address ? { address: input.address } : {}),
    },
  });
};

export const fetchOrders = async (): Promise<Order[]> => {
  const payload = await apiRequest<{ orders: Order[] }>('/orders', { auth: true });
  return payload.orders;
};

export type OrderTrackingStatus =
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

export interface OrderTrackingEvent {
  timestamp: string;
  location: string;
  description: string;
  status: OrderTrackingStatus;
}

export interface OrderTrackingPayload {
  orderId: string;
  status: OrderTrackingStatus;
  trackingCode?: string;
  carrier?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  events: OrderTrackingEvent[];
}

export const fetchOrderTracking = async (orderId: string): Promise<OrderTrackingPayload> => {
  return apiRequest<OrderTrackingPayload>(`/orders/${encodeURIComponent(orderId)}/tracking`, {
    auth: true,
  });
};

export const cancelOrder = async (orderId: string): Promise<{ ok: boolean; status: string }> => {
  return apiRequest<{ ok: boolean; status: string }>(
    `/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
      auth: true,
    },
  );
};

export const fetchOrderDetails = async (orderId: string): Promise<OrderDetailsPayload> => {
  return apiRequest<OrderDetailsPayload>(`/orders/${encodeURIComponent(orderId)}`, { auth: true });
};

export const fetchAddresses = async (): Promise<AddressesPayload> => {
  try {
    const result = await getAddressesFromFn();
    return {
      addresses: result.addresses,
      selectedAddressId: result.selectedAddressId,
    };
  } catch {
    return apiRequest<AddressesPayload>('/account/addresses', { auth: true });
  }
};

export const createAddress = async (
  draft: AddressDraft,
): Promise<{ address: Address } & AddressesPayload> => {
  try {
    const result = await addAddressToFn(draft);
    return {
      address: result.address,
      addresses: [result.address],
      selectedAddressId: result.address.id,
    };
  } catch {
    return apiRequest<{ address: Address } & AddressesPayload>('/account/addresses', {
      method: 'POST',
      auth: true,
      body: draft,
    });
  }
};

export const updateAddress = async (
  addressId: string,
  draft: AddressDraft,
): Promise<{ address: Address } & AddressesPayload> => {
  return apiRequest<{ address: Address } & AddressesPayload>(
    `/account/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'PUT',
      auth: true,
      body: draft,
    },
  );
};

export const deleteAddress = async (
  addressId: string,
): Promise<{ ok: true } & AddressesPayload> => {
  return apiRequest<{ ok: true } & AddressesPayload>(
    `/account/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'DELETE',
      auth: true,
    },
  );
};

export const selectAddress = async (
  addressId: string,
): Promise<{ ok: true; selectedAddressId: string }> => {
  return apiRequest<{ ok: true; selectedAddressId: string }>('/account/addresses/selected', {
    method: 'PUT',
    auth: true,
    body: { addressId },
  });
};

export const fetchAccountSettings = async (): Promise<AccountSettings> => {
  const payload = await apiRequest<{ settings: AccountSettings }>('/account/settings', {
    auth: true,
  });
  return payload.settings;
};

export const updateAccountSettings = async (
  patch: AccountSettingsPatch,
): Promise<AccountSettings> => {
  const payload = await apiRequest<{ settings: AccountSettings }>('/account/settings', {
    method: 'PATCH',
    auth: true,
    body: patch,
  });
  return payload.settings;
};

export const changePassword = async (input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> => {
  await apiRequest('/account/security/change-password', {
    method: 'POST',
    auth: true,
    body: input,
  });
};

export const fetchWishlist = async (): Promise<string[]> => {
  const payload = await apiRequest<{ productIds: string[] }>('/wishlist', { auth: true });
  return payload.productIds;
};

export const setWishlistProduct = async (productId: string, active: boolean): Promise<string[]> => {
  const payload = await apiRequest<{ productIds: string[] }>(
    `/wishlist/${encodeURIComponent(productId)}`,
    {
      method: 'PUT',
      auth: true,
      body: { active },
    },
  );
  return payload.productIds;
};

export const fetchBackInStockSubscriptions = async (): Promise<string[]> => {
  const payload = await apiRequest<{ productIds: string[] }>(
    '/catalog/back-in-stock/subscriptions',
    { auth: true },
  );
  return payload.productIds;
};

export const setBackInStockSubscription = async (
  productId: string,
  active: boolean,
): Promise<string[]> => {
  const payload = await apiRequest<{ productIds: string[] }>(
    `/catalog/back-in-stock/${encodeURIComponent(productId)}`,
    {
      method: 'PUT',
      auth: true,
      body: { active },
    },
  );
  return payload.productIds;
};

export const fetchSearchSuggestions = async (query: string): Promise<string[]> => {
  if (!query.trim()) return [];
  const payload = await apiRequest<{ suggestions: string[] }>(
    `/search/suggestions?q=${encodeURIComponent(query)}`,
  );
  return payload.suggestions;
};

export const fetchProductSearch = async (params: {
  query: string;
  page: number;
  perPage: number;
  sortBy: 'relevanta' | 'pretCrescator' | 'pretDescrescator' | 'numeAZ';
  categoryId?: string;
  vendor?: string;
  onlyInStock?: boolean;
  onlyDiscount?: boolean;
  priceMin?: number;
  priceMax?: number;
  includeFacets?: boolean;
}): Promise<ProductSearchPayload> => {
  const search = new URLSearchParams();
  search.set('q', params.query.trim() || '*');
  search.set('page', `${Math.max(1, Math.trunc(params.page))}`);
  search.set('perPage', `${Math.max(10, Math.trunc(params.perPage))}`);
  search.set('sortBy', params.sortBy);

  if (params.categoryId && params.categoryId.trim().length > 0)
    search.set('categoryId', params.categoryId.trim());
  if (params.vendor && params.vendor.trim().length > 0) search.set('vendor', params.vendor.trim());
  if (typeof params.onlyInStock === 'boolean')
    search.set('availableForSale', params.onlyInStock ? '1' : '0');
  if (typeof params.onlyDiscount === 'boolean')
    search.set('onlyDiscount', params.onlyDiscount ? '1' : '0');
  if (
    typeof params.priceMin === 'number' &&
    Number.isFinite(params.priceMin) &&
    params.priceMin > 0
  ) {
    search.set('priceMin', `${Math.trunc(params.priceMin)}`);
  }
  if (
    typeof params.priceMax === 'number' &&
    Number.isFinite(params.priceMax) &&
    params.priceMax > 0
  ) {
    search.set('priceMax', `${Math.trunc(params.priceMax)}`);
  }
  if (params.includeFacets) search.set('facets', '1');

  return apiRequest<ProductSearchPayload>(`/search/products?${search.toString()}`);
};

export const sendAnalyticsEvents = async (
  events: Array<{ name: string; payload?: Record<string, unknown>; timestamp?: string }>,
): Promise<void> => {
  if (events.length === 0) return;
  await apiRequest('/analytics/events', {
    method: 'POST',
    auth: true,
    body: { events },
  }).catch(() => undefined);
};

export const registerDeviceForNotifications = async (
  deviceId: string,
  platform: string,
  pushToken?: string,
): Promise<void> => {
  await apiRequest('/notifications/register', {
    method: 'POST',
    auth: true,
    body: {
      deviceId,
      platform,
      ...(pushToken ? { pushToken } : {}),
    },
  });
};

export const fetchDeviceSessions = async (deviceId?: string): Promise<DeviceSession[]> => {
  const payload = await apiRequest<{ sessions: DeviceSession[] }>('/account/sessions', {
    auth: true,
    headers: deviceId ? { 'x-device-id': deviceId } : undefined,
  });
  return payload.sessions;
};

export const revokeDeviceSession = async (sessionId: string): Promise<DeviceSession[]> => {
  const payload = await apiRequest<{ ok: true; sessions: DeviceSession[] }>(
    `/account/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'DELETE',
      auth: true,
    },
  );
  return payload.sessions;
};

export const fetchInbox = async (): Promise<InboxNotification[]> => {
  const payload = await apiRequest<{ notifications: InboxNotification[] }>('/notifications/inbox', {
    auth: true,
  });
  return payload.notifications;
};

export const markInboxNotificationRead = async (notificationId: string): Promise<void> => {
  await apiRequest('/notifications/read', {
    method: 'POST',
    auth: true,
    body: { notificationId },
  });
};

export const fetchLoyaltySummary = async (): Promise<LoyaltySummary> => {
  const payload = await apiRequest<unknown>('/loyalty/summary', { auth: true });
  return normalizeLoyaltySummary(payload);
};

export const redeemLoyaltyVoucher = async (
  points: number,
): Promise<{ voucher: LoyaltyVoucher; summary: LoyaltySummary }> => {
  const payload = await apiRequest<{ voucher?: unknown; summary?: unknown }>('/loyalty/redeem', {
    method: 'POST',
    auth: true,
    body: { points },
  });

  return {
    voucher: normalizeLoyaltyVoucher(payload?.voucher),
    summary: normalizeLoyaltySummary(payload?.summary),
  };
};

export const generateLoyaltyQr = async (): Promise<{
  qrToken: string;
  issuedAt: string;
  summary: LoyaltySummary;
}> => {
  const payload = await apiRequest<{ qrToken?: unknown; issuedAt?: unknown; summary?: unknown }>(
    '/loyalty/qr',
    {
      method: 'POST',
      auth: true,
    },
  );

  return {
    qrToken:
      typeof payload.qrToken === 'string' && payload.qrToken.length > 0
        ? payload.qrToken
        : 'unavailable-qr-token',
    issuedAt:
      typeof payload.issuedAt === 'string' && payload.issuedAt.length > 0
        ? payload.issuedAt
        : new Date().toISOString(),
    summary: normalizeLoyaltySummary(payload.summary),
  };
};

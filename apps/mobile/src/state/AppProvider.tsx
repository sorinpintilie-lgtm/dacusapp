import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Alert, AppState as RNAppState, Linking, Platform, Share } from 'react-native';

import type { CatalogCategory, CatalogProduct } from '../data/catalog';
import { buildDepartments } from '../data/departments';
import { useCatalog } from '../hooks/useCatalog';
import { closeAuthScreens, currentRouteName, goHome, openAccountScreen, openCart, openLogin } from '../navigation/navigationRef';
import {
  changePassword as changePasswordRequest,
  checkoutCart,
  checkoutCartGuest,
  createAddress,
  deleteAccount as deleteAccountRequest,
  deleteAddress as deleteAddressRequest,
  fetchAccountSettings,
  fetchAddresses,
  fetchBackInStockSubscriptions,
  fetchCart,
  fetchDeviceSessions,
  fetchInbox,
  fetchLoyaltySummary,
  fetchOrderDetails,
  fetchOrders,
  fetchWishlist,
  generateLoyaltyQr,
  loginAccount,
  logoutAccount,
  markInboxNotificationRead,
  redeemLoyaltyVoucher,
  registerAccount,
  registerDeviceForNotifications,
  removeCartLine,
  replaceCartLines,
  requestPasswordReset as requestPasswordResetRequest,
  restoreAccount,
  revokeDeviceSession,
  selectAddress as selectAddressRequest,
  sendAnalyticsEvents,
  setBackInStockSubscription,
  setWishlistProduct,
  updateAccountSettings,
  updateAddress,
  upsertCartLine,
  validateCart,
  validateGuestCart,
  type AccountSettings,
  type AccountSettingsPatch,
  type Address,
  type AddressDraft,
  type CartLine,
  type DeviceSession,
  type InboxNotification,
  type LoyaltySummary,
  type Order,
  type OrderDetailsPayload,
} from '../services/commerce';
import { initFirebase } from '../services/firebaseAuth';
import {
  getAppPreferences,
  getGuestCart,
  getOrCreateDeviceId,
  updateAppPreferences,
  updateGuestCart,
  type AppPreferences,
} from '../services/sessionStorage';
import { haptics } from '../ui/haptics';
import { useToast } from '../ui/Toast';
import { formatPrice } from '../utils/catalogFilters';
import { checkCheckoutOutcome } from '../utils/checkoutStatus';
import { isBroadCategoryName } from '../utils/string';
import { useStableCallback } from '../utils/useStableCallback';
import { describeFilters, SEARCH_DEFAULT_FILTERS, type ProductListFilters } from './productListFilters';

const HOME_SECTIONS_LIMIT = 6;
const CONTINUE_BROWSING_LIMIT = 18;
const SEARCH_HISTORY_LIMIT = 8;
export const COMPARE_PRODUCTS_LIMIT = 4;

const defaultLoyalty: LoyaltySummary = { points: 0, tier: 'Bronze', nextTierSpendRon: 1500 };

// Stable empty values, so derived lists keep their identity while preferences are loading.
const NO_IDS: string[] = [];
const NO_PRESETS: AppPreferences['filterPresets'] = [];
const NO_CART_LISTS: AppPreferences['savedCartLists'] = [];

type AccountUser = { id: string; email: string; name: string };
type TrustConsentKey = 'analytics' | 'personalization' | 'marketing';

export type CartItem = CartLine & {
  product: CatalogProduct;
  unitPriceRon: number;
  variantName?: string;
  stockRiskLabel?: string;
};

export type RecentFilterSnapshot = {
  id: string;
  label: string;
  query: string;
  filters: ProductListFilters;
};

export type HomeSection = { category: CatalogCategory; products: CatalogProduct[] };

const lineKey = (productId: string, variantId?: string) => `${productId}::${variantId ?? ''}`;

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const buildFallbackCartProduct = (line: CartLine): CatalogProduct => {
  const fallbackPrice =
    typeof line.unitPriceRon === 'number' && Number.isFinite(line.unitPriceRon) ? Number(line.unitPriceRon.toFixed(2)) : 0;
  const rawProductId = (line.productId ?? '').trim();
  const suffix = rawProductId.split('/').pop()?.trim() ?? rawProductId;
  const productToken = suffix.length > 0 ? suffix : 'necunoscut';

  return {
    id: rawProductId || `unknown-${productToken}`,
    categoryId: 'uncategorized',
    ...(line.variantId ? { variantId: line.variantId } : {}),
    name: `Produs indisponibil (${productToken})`,
    brand: 'Dacus',
    priceRon: fallbackPrice,
    stockLabel: 'Verificare disponibilitate la checkout',
  };
};

const pickBestCategoriesForHome = (categories: CatalogCategory[], products: CatalogProduct[], limit: number) => {
  const countByPrimaryCategory = new Map<string, number>();
  products.forEach((item) => {
    countByPrimaryCategory.set(item.categoryId, (countByPrimaryCategory.get(item.categoryId) ?? 0) + 1);
  });

  return categories
    .map((category) => ({ category, count: countByPrimaryCategory.get(category.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const broadDiff = Number(isBroadCategoryName(a.category.name)) - Number(isBroadCategoryName(b.category.name));
      if (broadDiff !== 0) return broadDiff;
      if (b.count !== a.count) return b.count - a.count;
      return a.category.name.localeCompare(b.category.name, 'ro');
    })
    .slice(0, limit)
    .map((item) => item.category);
};

const mergeAccountSettings = (base: AccountSettings, patch: AccountSettingsPatch): AccountSettings => {
  const now = new Date().toISOString();
  const withConsentPatch = (
    consent: AccountSettings['privacy']['analyticsConsent'],
    value: { granted?: boolean; source?: string } | undefined,
  ) => {
    if (!value) return consent;
    return {
      ...consent,
      ...value,
      updatedAt: now,
      source: typeof value.source === 'string' ? value.source : 'mobile_app',
    };
  };

  return {
    ...base,
    updatedAt: now,
    profile: { ...base.profile, ...(patch.profile ?? {}) },
    notifications: {
      email: { ...base.notifications.email, ...(patch.notifications?.email ?? {}) },
      push: { ...base.notifications.push, ...(patch.notifications?.push ?? {}) },
      inApp: { ...base.notifications.inApp, ...(patch.notifications?.inApp ?? {}) },
    },
    privacy: {
      analyticsConsent: withConsentPatch(base.privacy.analyticsConsent, patch.privacy?.analyticsConsent),
      personalizationConsent: withConsentPatch(
        base.privacy.personalizationConsent,
        patch.privacy?.personalizationConsent,
      ),
      marketingConsent: withConsentPatch(base.privacy.marketingConsent, patch.privacy?.marketingConsent),
    },
    security: { ...base.security, ...(patch.security ?? {}) },
  };
};

function useAppState() {
  const { show: showToast } = useToast();
  const { categories, products, productsById, countByCategory, productsByCategory } = useCatalog();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderDetailsById, setOrderDetailsById] = useState<Record<string, OrderDetailsPayload>>({});
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(() => new Set());
  const [recentFilterSnapshots, setRecentFilterSnapshots] = useState<RecentFilterSnapshot[]>([]);
  const [inbox, setInbox] = useState<InboxNotification[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(defaultLoyalty);
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [loyaltyRefreshing, setLoyaltyRefreshing] = useState(false);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(100);
  const [loyaltyQrToken, setLoyaltyQrToken] = useState<string | null>(null);
  const [voucherQrToken, setVoucherQrToken] = useState<string | null>(null);
  const [hasRequestedProfileQr, setHasRequestedProfileQr] = useState(false);
  const [profileQrError, setProfileQrError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [appPreferences, setAppPreferencesState] = useState<AppPreferences | null>(null);
  const [backInStockSubscriptions, setBackInStockSubscriptions] = useState<Set<string>>(() => new Set());
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [deviceId, setDeviceId] = useState(() => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const [shouldPromptBiometricAfterAuth, setShouldPromptBiometricAfterAuth] = useState(false);
  const [serverAccountSettings, setServerAccountSettings] = useState<AccountSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  // The guest cart is saved only after it was read back, so the empty initial cart never overwrites it.
  const guestCartLoadedRef = useRef(false);

  useEffect(() => {
    initFirebase();
  }, []);

  const persistPreferences = useStableCallback((updater: (current: AppPreferences) => AppPreferences) => {
    void updateAppPreferences(updater)
      .then((next) => setAppPreferencesState(next))
      .catch(() => undefined);
  });

  // ---- Preferences ----------------------------------------------------------------------------

  const favoriteCategoryIds = appPreferences?.favoriteCategoryIds ?? NO_IDS;
  const compareProductIds = appPreferences?.compareProductIds ?? NO_IDS;
  const filterPresets = appPreferences?.filterPresets ?? NO_PRESETS;
  const savedCartLists = appPreferences?.savedCartLists ?? NO_CART_LISTS;
  const recentSearches = appPreferences?.recentSearches ?? NO_IDS;
  const savedSearches = appPreferences?.savedSearches ?? NO_IDS;
  const trustConsent = appPreferences?.trustConsent ?? {
    analytics: true,
    personalization: true,
    marketing: false,
    updatedAt: new Date(0).toISOString(),
  };
  const preferenceOnboarding = appPreferences?.preferenceOnboarding ?? {
    completed: false,
    favoriteBrands: NO_IDS,
    favoriteCategories: NO_IDS,
    marketingOptIn: false,
  };
  const localAccountSettings = appPreferences?.accountSettings ?? {
    biometricLoginEnabled: false,
    biometricPromptShown: false,
    marketingEmailsEnabled: preferenceOnboarding.marketingOptIn,
  };

  const localFallbackAccountSettings = useMemo<AccountSettings>(
    () => ({
      schemaVersion: 1,
      updatedAt: trustConsent.updatedAt,
      profile: { displayName: accountUser?.name ?? '', locale: 'ro-RO' },
      notifications: {
        email: { marketing: trustConsent.marketing, orderUpdates: true, securityAlerts: true },
        push: { marketing: trustConsent.marketing, orderUpdates: true, securityAlerts: true, backInStock: true },
        inApp: { marketing: trustConsent.marketing, orderUpdates: true, securityAlerts: true },
      },
      privacy: {
        analyticsConsent: { granted: trustConsent.analytics, updatedAt: trustConsent.updatedAt, source: 'local_preferences' },
        personalizationConsent: {
          granted: trustConsent.personalization,
          updatedAt: trustConsent.updatedAt,
          source: 'local_preferences',
        },
        marketingConsent: { granted: trustConsent.marketing, updatedAt: trustConsent.updatedAt, source: 'local_preferences' },
      },
      security: { loginAlerts: true, twoFactorEnabled: false },
    }),
    [accountUser?.name, trustConsent.analytics, trustConsent.marketing, trustConsent.personalization, trustConsent.updatedAt],
  );
  const effectiveAccountSettings = serverAccountSettings ?? localFallbackAccountSettings;

  useEffect(() => {
    void getAppPreferences()
      .then((prefs) => setAppPreferencesState(prefs))
      .catch(() => setAppPreferencesState(null));
  }, []);

  // ---- Catalog views ----------------------------------------------------------------------------

  const featuredCategories = useMemo(() => {
    const best = pickBestCategoriesForHome(categories, products, HOME_SECTIONS_LIMIT);
    return [
      ...best.filter((item) => favoriteCategoryIds.includes(item.id)),
      ...best.filter((item) => !favoriteCategoryIds.includes(item.id)),
    ];
  }, [categories, favoriteCategoryIds, products]);

  const homeSections = useMemo<HomeSection[]>(() => {
    const byPrimaryCategory = new Map<string, CatalogProduct[]>();
    products.forEach((item) => {
      const list = byPrimaryCategory.get(item.categoryId);
      if (list) list.push(item);
      else byPrimaryCategory.set(item.categoryId, [item]);
    });

    return pickBestCategoriesForHome(categories, products, HOME_SECTIONS_LIMIT * 2)
      .map((category) => ({ category, products: byPrimaryCategory.get(category.id) ?? [] }))
      .filter((section) => section.products.length > 0)
      .slice(0, HOME_SECTIONS_LIMIT);
  }, [categories, products]);

  const departments = useMemo(() => buildDepartments(categories, productsByCategory), [categories, productsByCategory]);

  const orderedCategories = useMemo(() => {
    const favorites = new Set(favoriteCategoryIds);
    return [...categories].sort((a, b) => {
      const favoriteDiff = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
      if (favoriteDiff !== 0) return favoriteDiff;
      const countDiff = (countByCategory.get(b.id) ?? 0) - (countByCategory.get(a.id) ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.name.localeCompare(b.name, 'ro');
    });
  }, [categories, countByCategory, favoriteCategoryIds]);

  const trendingSearches = useMemo(
    () =>
      Array.from(
        new Set([...featuredCategories.map((item) => item.name), ...products.slice(0, 4).map((item) => item.brand)]).values(),
      ).slice(0, 8),
    [featuredCategories, products],
  );

  const continueBrowsingIds = appPreferences?.continueBrowsingProductIds ?? NO_IDS;
  const continueBrowsingProducts = useMemo(
    () =>
      continueBrowsingIds
        .map((id) => productsById.get(id))
        .filter((item): item is CatalogProduct => !!item)
        .slice(0, 8),
    [continueBrowsingIds, productsById],
  );

  const continueBrowsingCategoryIds = appPreferences?.continueBrowsingCategoryIds ?? NO_IDS;
  const continueBrowsingCategories = useMemo(() => {
    const ids = new Set(continueBrowsingCategoryIds);
    return categories.filter((item) => ids.has(item.id));
  }, [categories, continueBrowsingCategoryIds]);

  const compareProducts = useMemo(
    () => compareProductIds.map((id) => productsById.get(id)).filter((item): item is CatalogProduct => !!item),
    [compareProductIds, productsById],
  );

  const wishlistProducts = useMemo(
    () => Array.from(wishlist).map((id) => productsById.get(id)).filter((item): item is CatalogProduct => !!item),
    [productsById, wishlist],
  );

  // ---- Cart -----------------------------------------------------------------------------------

  const resolveUnitPriceRon = (productId: string, variantId?: string): number | null => {
    const product = productsById.get(productId);
    if (!product) return null;
    const variant = variantId ? product.variants?.find((item) => item.id === variantId) : undefined;
    const amount = variant?.priceRon ?? product.priceRon;
    if (!Number.isFinite(amount)) return null;
    return Number(amount.toFixed(2));
  };

  const cartItems = useMemo<CartItem[]>(
    () =>
      cart.map((line) => {
        const product = productsById.get(line.productId) ?? buildFallbackCartProduct(line);
        const variant = line.variantId ? product.variants?.find((item) => item.id === line.variantId) : undefined;
        const normalizedStock = (typeof product.stockLabel === 'string' ? product.stockLabel : '').toLowerCase();
        const stockRiskLabel =
          normalizedStock.includes('limitat') || normalizedStock.includes('ultim')
            ? 'Risc stoc: ridicat'
            : normalizedStock.includes('indisponibil') || normalizedStock.includes('epuizat')
              ? 'Risc stoc: critic'
              : 'Risc stoc: redus';
        const unitPriceRon =
          typeof line.unitPriceRon === 'number' && Number.isFinite(line.unitPriceRon)
            ? Number(line.unitPriceRon.toFixed(2))
            : (variant?.priceRon ?? product.priceRon);
        // Single-variant products are named "Default Title" in Shopify; that is not worth showing.
        const variantName =
          variant?.name && variant.name !== 'Default Title'
            ? variant.name
            : !variant && line.variantId && line.variantId !== product.variantId
              ? `Varianta ${line.variantId.split('/').pop()}`
              : undefined;

        return { ...line, product, unitPriceRon, ...(variantName ? { variantName } : {}), stockRiskLabel };
      }),
    [cart, productsById],
  );

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.unitPriceRon * item.quantity, 0);
  const deliveryEtaLabel =
    cartItems.length === 0
      ? 'Adaugă produse pentru estimare livrare.'
      : cartItems.some((item) => item.stockRiskLabel?.includes('critic') || item.stockRiskLabel?.includes('ridicat'))
        ? 'Livrare estimată în 2-4 zile lucrătoare (stoc variabil)'
        : 'Livrare estimată în 24-48h pentru majoritatea produselor';
  const changedPriceCount = cartItems.filter((item) => Math.abs(item.unitPriceRon - item.product.priceRon) >= 0.01).length;
  const priceChangeExplanation =
    changedPriceCount > 0
      ? `${changedPriceCount} produs(e) au preț actualizat în coș (promoții sau variantă selectată).`
      : null;

  const findLine = (productId: string, variantId?: string) =>
    cart.find((line) => lineKey(line.productId, line.variantId) === lineKey(productId, variantId));

  // One id per install, so the account's device list and push registration don't grow on every launch.
  useEffect(() => {
    void getOrCreateDeviceId(deviceId).then(setDeviceId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void getGuestCart()
      .then((guestCart) => {
        guestCartLoadedRef.current = true;
        if (guestCart.length === 0) return;
        const known = guestCart.filter((item) => productsById.has(item.productId));
        // Only fill an untouched guest cart: a restored account or items added meanwhile take priority.
        setCart((current) => (current.length === 0 ? known : current));
      })
      .catch(() => {
        guestCartLoadedRef.current = true;
      });
    // Read once at startup; productsById is the fixed bundled catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accountUser || !guestCartLoadedRef.current) return;
    void updateGuestCart(cart).catch(() => undefined);
  }, [accountUser, cart]);

  const addToCart = useStableCallback((productId: string, variantId?: string, options?: { silent?: boolean }) => {
    const product = productsById.get(productId);
    if (!product) {
      showToast('Produsul nu este disponibil momentan.', 'error');
      return;
    }
    const resolvedVariantId = variantId || product.variantId || undefined;
    const unitPriceRon = resolveUnitPriceRon(productId, resolvedVariantId);
    const existingQty = findLine(productId, resolvedVariantId)?.quantity ?? 0;

    setCart((prev) => {
      const key = lineKey(productId, resolvedVariantId);
      if (!prev.some((line) => lineKey(line.productId, line.variantId) === key)) {
        return [
          ...prev,
          {
            productId,
            ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
            quantity: 1,
            ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
          },
        ];
      }
      return prev.map((line) =>
        lineKey(line.productId, line.variantId) === key
          ? { ...line, quantity: line.quantity + 1, ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}) }
          : line,
      );
    });

    if (accountUser) {
      void upsertCartLine({
        productId,
        ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
        quantity: existingQty + 1,
        ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
      }).catch(() => undefined);
    }

    if (!options?.silent) {
      haptics.success();
      showToast('Adăugat în coș', { actionLabel: 'Vezi coșul', onAction: openCart });
    }
    void sendAnalyticsEvents([
      {
        name: 'add_to_cart',
        payload: { productId, variantId: resolvedVariantId ?? null, page: currentRouteName() ?? 'unknown' },
      },
    ]);
  });

  const changeQuantity = useStableCallback((productId: string, variantId: string | undefined, delta: number) => {
    const key = lineKey(productId, variantId);
    setCart((prev) =>
      prev
        .map((line) =>
          lineKey(line.productId, line.variantId) === key ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line,
        )
        .filter((line) => line.quantity > 0),
    );

    if (accountUser) {
      const current = findLine(productId, variantId);
      const nextQty = Math.max(0, (current?.quantity ?? 0) + delta);
      const unitPriceRon =
        typeof current?.unitPriceRon === 'number' ? current.unitPriceRon : resolveUnitPriceRon(productId, variantId);
      void upsertCartLine({
        productId,
        ...(variantId ? { variantId } : {}),
        quantity: nextQty,
        ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
      }).catch(() => undefined);
    }
  });

  const restoreCartLine = (line: CartLine) => {
    setCart((prev) => {
      const key = lineKey(line.productId, line.variantId);
      if (!prev.some((item) => lineKey(item.productId, item.variantId) === key)) return [...prev, line];
      return prev.map((item) =>
        lineKey(item.productId, item.variantId) === key ? { ...item, quantity: item.quantity + line.quantity } : item,
      );
    });
    if (accountUser) void upsertCartLine(line).catch(() => undefined);
  };

  const removeCartItem = useStableCallback((productId: string, variantId: string | undefined) => {
    const removedLine = findLine(productId, variantId);
    const removedName = productsById.get(productId)?.name ?? 'Produsul';
    const key = lineKey(productId, variantId);
    setCart((prev) => prev.filter((line) => lineKey(line.productId, line.variantId) !== key));

    if (removedLine) {
      showToast(`${removedName} a fost eliminat.`, {
        tone: 'info',
        actionLabel: 'Anulează',
        onAction: () => restoreCartLine(removedLine),
      });
    }

    if (accountUser) {
      void removeCartLine(productId, variantId)
        .then((lines) => setCart(lines))
        .catch((error) => showToast(errorMessage(error, 'Nu am putut elimina produsul din coș.'), 'error'));
    }
  });

  const saveCurrentCartAsList = useStableCallback(() => {
    if (cart.length === 0) {
      showToast('Coșul este gol. Nu există nimic de salvat.', 'error');
      return;
    }
    const snapshot = {
      id: `cart-list-${Date.now()}`,
      name: `Lista ${savedCartLists.length + 1}`,
      createdAt: new Date().toISOString(),
      lines: cart.map((item) => ({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        quantity: item.quantity,
        ...(typeof item.unitPriceRon === 'number' ? { unitPriceRon: item.unitPriceRon } : {}),
      })),
    };
    persistPreferences((current) => ({ ...current, savedCartLists: [snapshot, ...current.savedCartLists].slice(0, 15) }));
    showToast('Coșul a fost salvat ca listă.');
  });

  const restoreCartList = useStableCallback((listId: string) => {
    const list = savedCartLists.find((item) => item.id === listId);
    if (!list) return;
    const previousCart = cart;
    setCart(list.lines);
    if (!accountUser) {
      showToast(`Listă restaurată: ${list.name}`);
      return;
    }
    void replaceCartLines(list.lines)
      .then((lines) => {
        setCart(lines);
        showToast(`Listă restaurată: ${list.name}`);
      })
      .catch((error) => {
        setCart(previousCart);
        showToast(errorMessage(error, 'Nu am putut restaura lista în coș.'), 'error');
      });
  });

  const removeSavedCartList = useStableCallback((listId: string) => {
    persistPreferences((current) => ({
      ...current,
      savedCartLists: current.savedCartLists.filter((item) => item.id !== listId),
    }));
  });

  // ---- Browsing, wishlist, compare --------------------------------------------------------------

  const trackProductView = useStableCallback((productId: string) => {
    const categoryId = productsById.get(productId)?.categoryId;
    persistPreferences((current) => ({
      ...current,
      continueBrowsingProductIds: [
        productId,
        ...current.continueBrowsingProductIds.filter((item) => item !== productId),
      ].slice(0, CONTINUE_BROWSING_LIMIT),
      continueBrowsingCategoryIds: categoryId
        ? [categoryId, ...current.continueBrowsingCategoryIds.filter((item) => item !== categoryId)].slice(
            0,
            CONTINUE_BROWSING_LIMIT,
          )
        : current.continueBrowsingCategoryIds,
    }));
  });

  const trackCategoryView = useStableCallback((categoryId: string) => {
    persistPreferences((current) => ({
      ...current,
      continueBrowsingCategoryIds: [
        categoryId,
        ...current.continueBrowsingCategoryIds.filter((item) => item !== categoryId),
      ].slice(0, CONTINUE_BROWSING_LIMIT),
    }));
  });

  const toggleWishlist = useStableCallback((productId: string) => {
    const previous = new Set(wishlist);
    const active = wishlist.has(productId);
    const next = new Set(wishlist);
    if (active) next.delete(productId);
    else next.add(productId);
    setWishlist(next);
    haptics.selection();

    if (accountUser) {
      void setWishlistProduct(productId, !active)
        .then((ids) => setWishlist(new Set(ids)))
        .catch((error) => {
          setWishlist(previous);
          showToast(errorMessage(error, 'Nu am putut actualiza favoritele.'), 'error');
        });
    }
  });

  const toggleBackInStockAlert = useStableCallback((productId: string) => {
    if (!accountUser) {
      showToast('Autentifică-te pentru alerte de stoc.', 'info');
      openLogin();
      return;
    }

    const previous = new Set(backInStockSubscriptions);
    const currentlyActive = backInStockSubscriptions.has(productId);
    const next = new Set(backInStockSubscriptions);
    if (currentlyActive) next.delete(productId);
    else next.add(productId);
    setBackInStockSubscriptions(next);

    void setBackInStockSubscription(productId, !currentlyActive)
      .then((ids) => setBackInStockSubscriptions(new Set(ids)))
      .then(() => showToast(currentlyActive ? 'Alerta de stoc a fost dezactivată.' : 'Te anunțăm când revine în stoc.'))
      .catch((error) => {
        setBackInStockSubscriptions(previous);
        showToast(errorMessage(error, 'Nu am putut actualiza alerta de stoc.'), 'error');
      });
  });

  const toggleCompareProduct = useStableCallback((productId: string) => {
    if (!productId || !productsById.has(productId)) return;
    persistPreferences((current) => {
      if (current.compareProductIds.includes(productId)) {
        return { ...current, compareProductIds: current.compareProductIds.filter((item) => item !== productId) };
      }
      return { ...current, compareProductIds: [...current.compareProductIds, productId].slice(-COMPARE_PRODUCTS_LIMIT) };
    });
  });

  const clearCompareProducts = useStableCallback(() => {
    persistPreferences((current) => ({ ...current, compareProductIds: [] }));
  });

  const saveFilterPreset = useStableCallback((filters: ProductListFilters) => {
    const preset = {
      id: `preset-${Date.now()}`,
      name: describeFilters(filters) || `Preset ${filterPresets.length + 1}`,
      brandFilter: filters.brandFilter,
      priceFilter: filters.priceFilter,
      onlyDiscount: filters.onlyDiscount,
      onlyInStock: filters.onlyInStock,
      sortOption: filters.sortOption,
    };
    persistPreferences((current) => ({ ...current, filterPresets: [preset, ...current.filterPresets].slice(0, 10) }));
    showToast('Filtrele au fost salvate.');
  });

  const deleteFilterPreset = useStableCallback((presetId: string) => {
    persistPreferences((current) => ({
      ...current,
      filterPresets: current.filterPresets.filter((item) => item.id !== presetId),
    }));
  });

  // ---- Search history ---------------------------------------------------------------------------

  const recordSearch = useStableCallback((query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    persistPreferences((current) => ({
      ...current,
      recentSearches: [normalized, ...current.recentSearches.filter((item) => item !== normalized)].slice(
        0,
        SEARCH_HISTORY_LIMIT,
      ),
    }));
  });

  const clearRecentSearches = useStableCallback(() => {
    persistPreferences((current) => ({ ...current, recentSearches: [] }));
  });

  const toggleSavedSearch = useStableCallback((query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    const alreadySaved = savedSearches.includes(normalized);
    persistPreferences((current) => ({
      ...current,
      savedSearches: alreadySaved
        ? current.savedSearches.filter((item) => item !== normalized)
        : [normalized, ...current.savedSearches].slice(0, SEARCH_HISTORY_LIMIT),
    }));
    showToast(alreadySaved ? 'Căutarea a fost ștearsă din salvate.' : 'Căutare salvată.');
  });

  const recordFilterSnapshot = useStableCallback((query: string, filters: ProductListFilters) => {
    const label = describeFilters(filters, SEARCH_DEFAULT_FILTERS);
    if (!label || !query.trim()) return;
    const snapshot: RecentFilterSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: `${query.trim()}: ${label}`,
      query: query.trim(),
      filters,
    };
    setRecentFilterSnapshots((prev) => [snapshot, ...prev.filter((item) => item.label !== snapshot.label)].slice(0, 8));
  });

  // ---- Account ------------------------------------------------------------------------------------

  const syncLocalPreferencesFromServerSettings = useStableCallback((settings: AccountSettings) => {
    const updatedAt = settings.updatedAt || new Date().toISOString();
    persistPreferences((current) => ({
      ...current,
      trustConsent: {
        analytics: settings.privacy.analyticsConsent.granted,
        personalization: settings.privacy.personalizationConsent.granted,
        marketing: settings.privacy.marketingConsent.granted,
        updatedAt,
      },
      preferenceOnboarding: { ...current.preferenceOnboarding, marketingOptIn: settings.privacy.marketingConsent.granted },
      accountSettings: { ...current.accountSettings, marketingEmailsEnabled: settings.privacy.marketingConsent.granted },
    }));
  });

  /** Loads everything that belongs to the signed-in account. */
  const hydrateAccount = useStableCallback(async () => {
    const [cartLines, orderItems, wishlistIds, inboxItems, loyaltySummary, addressPayload, subscribedIds, sessions, settings] =
      await Promise.all([
        fetchCart(),
        fetchOrders(),
        fetchWishlist(),
        fetchInbox(),
        fetchLoyaltySummary(),
        fetchAddresses(),
        fetchBackInStockSubscriptions(),
        fetchDeviceSessions(deviceId),
        fetchAccountSettings().catch(() => null),
      ]);

    // Lines for products that are no longer in the catalog cannot be shown or checked out.
    setCart(cartLines.filter((item) => productsById.has(item.productId)));
    setOrders(orderItems);
    setWishlist(new Set(wishlistIds));
    setInbox(inboxItems);
    setLoyalty(loyaltySummary);
    setLoyaltyQrToken(loyaltySummary.loyaltyQrToken ?? null);
    setHasRequestedProfileQr(!!loyaltySummary.loyaltyQrToken);
    setProfileQrError(null);
    setVoucherQrToken(loyaltySummary.lastVoucher?.qrToken ?? null);
    setAddresses(addressPayload.addresses);
    setSelectedAddressId(addressPayload.selectedAddressId);
    setBackInStockSubscriptions(new Set(subscribedIds));
    setDeviceSessions(sessions);
    if (settings) {
      setServerAccountSettings(settings);
      syncLocalPreferencesFromServerSettings(settings);
    }
  });

  useEffect(() => {
    void restoreAccount().then(async (user) => {
      if (!user) return;

      const prefs = await getAppPreferences().catch(() => null);
      if (prefs?.accountSettings.biometricLoginEnabled) {
        const { authenticateWithBiometric } = await import('../services/biometric');
        const result = await authenticateWithBiometric('Autentifică-te pentru a accesa contul');
        if (!result.success) {
          await logoutAccount();
          return;
        }
      }

      setAccountUser(user);
      void hydrateAccount().catch((error) => console.error('[BOOT][AuthHydration] post-auth bootstrap failed', error));
    });
  }, [hydrateAccount]);

  useEffect(() => {
    if (accountUser) return;
    setServerAccountSettings(null);
    setHasRequestedProfileQr(false);
    setProfileQrError(null);
  }, [accountUser]);

  useEffect(() => {
    if (!accountUser || loyaltyQrToken || hasRequestedProfileQr || profileQrError) return;
    setHasRequestedProfileQr(true);
    setProfileQrError(null);
    void generateLoyaltyQr()
      .then((payload) => {
        setLoyalty(payload.summary);
        setLoyaltyQrToken(payload.qrToken);
        setHasRequestedProfileQr(true);
      })
      .catch((error) => {
        setHasRequestedProfileQr(false);
        setProfileQrError(errorMessage(error, 'Nu am putut genera codul QR de fidelitate.'));
      });
  }, [accountUser, hasRequestedProfileQr, loyaltyQrToken, profileQrError]);

  const setBiometricLogin = (enabled: boolean) =>
    persistPreferences((current) => ({
      ...current,
      accountSettings: { ...current.accountSettings, biometricPromptShown: true, biometricLoginEnabled: enabled },
    }));

  useEffect(() => {
    if (!shouldPromptBiometricAfterAuth || appPreferences === null) return;
    setShouldPromptBiometricAfterAuth(false);
    if (localAccountSettings.biometricPromptShown) return;
    Alert.alert(
      'Activezi login biometric?',
      'Pentru următoarele autentificări poți folosi Face ID sau amprenta pe acest dispozitiv.',
      [
        {
          text: 'Nu acum',
          style: 'cancel',
          onPress: () => {
            setBiometricLogin(false);
            showToast('Poți activa loginul biometric din Setări.', 'info');
          },
        },
        {
          text: 'Activează',
          onPress: () => {
            setBiometricLogin(true);
            showToast('Login biometric activat pe acest dispozitiv.');
          },
        },
      ],
    );
    // setBiometricLogin and showToast only persist or display; they do not affect when this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appPreferences, localAccountSettings.biometricPromptShown, shouldPromptBiometricAfterAuth]);

  const afterSignIn = (welcome: string) => {
    setShouldPromptBiometricAfterAuth(true);
    closeAuthScreens();
    showToast(welcome);
    void registerDeviceForNotifications(`${Platform.OS}-${Date.now()}`, Platform.OS).catch(() => undefined);
  };

  const login = useStableCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setAuthError('Completează emailul și parola.');
      return false;
    }
    if (!trimmedEmail.includes('@')) {
      setAuthError('Email invalid.');
      return false;
    }

    setAuthError(null);
    setAuthBusy(true);
    try {
      const user = await loginAccount(trimmedEmail, password);
      setAccountUser(user);
      await hydrateAccount();
      afterSignIn('Autentificare reușită. Bine ai revenit!');
      return true;
    } catch (error) {
      setAuthError(errorMessage(error, 'Autentificare eșuată. Verifică datele și încearcă din nou.'));
      return false;
    } finally {
      setAuthBusy(false);
    }
  });

  const completePreferenceOnboarding = useStableCallback(() => {
    persistPreferences((current) => ({
      ...current,
      preferenceOnboarding: { ...current.preferenceOnboarding, completed: true },
    }));
  });

  const register = useStableCallback(async (email: string, password: string, name: string) => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || !password.trim() || !trimmedName) {
      setAuthError('Completează toate câmpurile pentru înregistrare.');
      return false;
    }
    if (!trimmedEmail.includes('@')) {
      setAuthError('Email invalid.');
      return false;
    }
    if (password.length < 6) {
      setAuthError('Parola trebuie să aibă minimum 6 caractere.');
      return false;
    }

    setAuthError(null);
    setAuthBusy(true);
    try {
      const user = await registerAccount(trimmedEmail, password, trimmedName);
      setAccountUser(user);
      await hydrateAccount();
      completePreferenceOnboarding();
      afterSignIn('Cont creat cu succes. Bine ai venit!');
      return true;
    } catch (error) {
      setAuthError(errorMessage(error, 'Înregistrare eșuată. Verifică datele și încearcă din nou.'));
      return false;
    } finally {
      setAuthBusy(false);
    }
  });

  const requestPasswordReset = useStableCallback(async (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setAuthError('Introdu un email valid pentru resetarea parolei.');
      return;
    }
    setAuthError(null);
    setAuthBusy(true);
    try {
      await requestPasswordResetRequest(trimmedEmail);
      showToast('Emailul de resetare a fost trimis.');
    } catch (error) {
      setAuthError(errorMessage(error, 'Nu s-a putut trimite emailul de resetare momentan.'));
    } finally {
      setAuthBusy(false);
    }
  });

  const clearAuthError = useStableCallback(() => setAuthError(null));

  const deleteAccount = useStableCallback(async () => {
    setAuthBusy(true);
    try {
      await deleteAccountRequest();
    } catch (error) {
      setAuthBusy(false);
      showToast(errorMessage(error, 'Nu am putut șterge contul. Încearcă din nou.'), 'error');
      return false;
    }
    await logout();
    showToast('Contul tău a fost șters.');
    goHome();
    return true;
  });

  const logout = useStableCallback(async () => {
    setAuthBusy(true);
    try {
      await logoutAccount();
      setAccountUser(null);
      setAuthError(null);
      setCart([]);
      setOrders([]);
      setWishlist(new Set());
      setInbox([]);
      setOrderDetailsById({});
      setAddresses([]);
      setSelectedAddressId(null);
      setBackInStockSubscriptions(new Set());
      setDeviceSessions([]);
      setLoyalty(defaultLoyalty);
      setLoyaltyQrToken(null);
      setVoucherQrToken(null);
      setServerAccountSettings(null);
      setHasRequestedProfileQr(false);
      setProfileQrError(null);
      setShouldPromptBiometricAfterAuth(false);
      goHome();
      showToast('Te-ai deconectat.');
    } finally {
      setAuthBusy(false);
    }
  });

  const loadOrderDetails = useStableCallback(async (orderId: string) => {
    if (!accountUser || orderDetailsById[orderId]) return;
    try {
      const payload = await fetchOrderDetails(orderId);
      setOrderDetailsById((prev) => ({ ...prev, [orderId]: payload }));
    } catch (error) {
      showToast(errorMessage(error, 'Nu am putut încărca detaliile comenzii.'), 'error');
    }
  });

  const markInboxRead = useStableCallback((notificationId: string) => {
    void markInboxNotificationRead(notificationId)
      .then(() => fetchInbox())
      .then((items) => setInbox(items))
      .catch(() => undefined);
  });

  const refreshDeviceSessions = useStableCallback(() => {
    if (!accountUser) return;
    void fetchDeviceSessions(deviceId)
      .then((sessions) => setDeviceSessions(sessions))
      .catch(() => undefined);
  });

  const revokeSession = useStableCallback((sessionId: string) => {
    if (!accountUser) return;
    void revokeDeviceSession(sessionId)
      .then((sessions) => {
        setDeviceSessions(sessions);
        showToast('Sesiunea dispozitivului a fost revocată.');
      })
      .catch((error) => showToast(errorMessage(error, 'Nu am putut revoca sesiunea.'), 'error'));
  });

  // ---- Addresses ------------------------------------------------------------------------------

  /** Creates or updates an address; throws with a user-facing message on failure. */
  const saveAddress = useStableCallback(async (draft: AddressDraft, addressId?: string) => {
    if (!accountUser) throw new Error('Autentifică-te pentru a salva adrese.');
    setAddressBusy(true);
    try {
      const payload = addressId ? await updateAddress(addressId, draft) : await createAddress(draft);
      setAddresses(payload.addresses);
      setSelectedAddressId(payload.selectedAddressId);
      showToast(addressId ? 'Adresa a fost actualizată.' : 'Adresă de livrare adăugată.');
    } finally {
      setAddressBusy(false);
    }
  });

  const selectAddress = useStableCallback((addressId: string) => {
    if (!accountUser || addressBusy) return;
    const previousAddressId = selectedAddressId;
    setSelectedAddressId(addressId);
    setAddressBusy(true);
    void selectAddressRequest(addressId)
      .then(() => showToast('Adresa de livrare a fost actualizată.'))
      .catch((error) => {
        setSelectedAddressId(previousAddressId);
        showToast(errorMessage(error, 'Nu am putut selecta adresa.'), 'error');
      })
      .finally(() => setAddressBusy(false));
  });

  const deleteAddress = useStableCallback((addressId: string) => {
    if (!accountUser || addressBusy) return;
    setAddressBusy(true);
    void deleteAddressRequest(addressId)
      .then((payload) => {
        setAddresses(payload.addresses);
        setSelectedAddressId(payload.selectedAddressId);
        showToast('Adresă eliminată.');
      })
      .catch((error) => showToast(errorMessage(error, 'Nu am putut șterge adresa.'), 'error'))
      .finally(() => setAddressBusy(false));
  });

  // ---- Checkout -------------------------------------------------------------------------------

  const failCheckout = (message: string) => {
    setCheckoutError(message);
    showToast(message, 'error');
  };

  // Payment happens on the store's checkout page, opened inside the app (Safari view / Chrome custom tab).
  const openCheckoutUrl = async (url: string) => {
    try {
      return await WebBrowser.openBrowserAsync(url, { controlsColor: '#D20A11', dismissButtonStyle: 'close' });
    } catch {
      return Linking.openURL(url)
        .then(() => null)
        .catch(() => {
          showToast('Nu am putut deschide pagina de plată.', 'error');
          return null;
        });
    }
  };

  // A guest's cart is emptied only once Shopify has turned the checkout into an order. Checked when the
  // checkout page closes (iOS) or when the app comes back to the foreground (Android custom tabs).
  const pendingGuestCheckoutRef = useRef<string | null>(null);
  const settleGuestCheckout = useStableCallback(async () => {
    const url = pendingGuestCheckoutRef.current;
    if (!url) return;
    pendingGuestCheckoutRef.current = null;
    const outcome = await checkCheckoutOutcome(url);
    if (outcome === 'completed') {
      setCart([]);
      void updateGuestCart([]).catch(() => undefined);
      showToast('Comanda a fost plasată. Mulțumim!');
      goHome();
    } else if (outcome === 'open') {
      showToast('Plata nu a fost finalizată. Produsele au rămas în coș.', 'info');
    }
  });
  useEffect(() => {
    const subscription = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') void settleGuestCheckout();
    });
    return () => subscription.remove();
  }, [settleGuestCheckout]);

  const processCheckout = useStableCallback(async () => {
    const validCartItems = cart.filter((item) => productsById.has(item.productId));
    if (validCartItems.length !== cart.length) setCart(validCartItems);
    if (validCartItems.length === 0) {
      failCheckout('Coșul este gol.');
      return;
    }
    if (accountUser && !selectedAddressId) {
      failCheckout('Alege o adresă de livrare înainte de plată.');
      return;
    }

    setCheckoutError(null);
    setCheckoutBusy(true);
    try {
      if (!accountUser) {
        const validation = await validateGuestCart(validCartItems);
        if (!validation.ok) {
          const firstIssue = validation.issues[0];
          throw new Error(firstIssue?.messageRo ?? firstIssue?.message ?? 'Coșul trebuie actualizat înainte de plată.');
        }
        setCart(validation.lines);
        const payload = await checkoutCartGuest({ lines: validation.lines, address: undefined, deviceId });
        pendingGuestCheckoutRef.current = payload.checkoutUrl;
        const result = await openCheckoutUrl(payload.checkoutUrl);
        // iOS resolves when the page is closed; Android resolves at once and settles on return to the app.
        if (result && result.type !== 'opened') await settleGuestCheckout();
        return;
      }

      const validation = await validateCart();
      if (!validation.ok) {
        const firstIssue = validation.issues[0];
        throw new Error(firstIssue?.messageRo ?? firstIssue?.message ?? 'Coșul trebuie actualizat înainte de plată.');
      }
      setCart(validation.lines);
      const payload = await checkoutCart({ addressId: selectedAddressId ?? undefined });
      showToast(`Continuă plata de ${formatPrice(payload.totalRon)} în pagina securizată.`);
      const [nextOrders, nextCart, orderDetails] = await Promise.all([
        fetchOrders(),
        fetchCart(),
        fetchOrderDetails(payload.orderId),
        openCheckoutUrl(payload.checkoutUrl),
      ]);
      setOrders(nextOrders);
      setCart(nextCart);
      setOrderDetailsById((prev) => ({ ...prev, [orderDetails.order.id]: orderDetails }));
      openAccountScreen('Orders');
    } catch (error) {
      failCheckout(errorMessage(error, 'Plata nu este disponibilă momentan.'));
    } finally {
      setCheckoutBusy(false);
    }
  });

  // ---- Loyalty --------------------------------------------------------------------------------

  const currentTierTarget = loyalty.tier === 'Bronze' ? 1500 : 5000;
  const tierProgress =
    loyalty.tier === 'Gold'
      ? 1
      : Math.min(1, Math.max(0, currentTierTarget - loyalty.nextTierSpendRon) / currentTierTarget);
  const voucherValueRon = loyalty.lastVoucher?.valueRon ?? Math.floor(loyalty.points / 100) * 5;

  const refreshLoyalty = useStableCallback(() => {
    if (!accountUser) {
      openLogin();
      return;
    }
    setLoyaltyRefreshing(true);
    void Promise.all([fetchLoyaltySummary(), fetchInbox()])
      .then(([summary, nextInbox]) => {
        setLoyalty(summary);
        setLoyaltyQrToken(summary.loyaltyQrToken ?? null);
        setHasRequestedProfileQr(!!summary.loyaltyQrToken);
        setProfileQrError(null);
        setVoucherQrToken(summary.lastVoucher?.qrToken ?? null);
        setInbox(nextInbox);
      })
      .catch((error) => showToast(errorMessage(error, 'Actualizarea fidelității a eșuat momentan.'), 'error'))
      .finally(() => setLoyaltyRefreshing(false));
  });

  const retryLoyaltyQr = useStableCallback(() => {
    if (!accountUser) {
      openLogin();
      return;
    }
    setProfileQrError(null);
    setHasRequestedProfileQr(true);
    void generateLoyaltyQr()
      .then((payload) => {
        setLoyalty(payload.summary);
        setLoyaltyQrToken(payload.qrToken);
        setHasRequestedProfileQr(true);
      })
      .catch((error) => {
        setProfileQrError(errorMessage(error, 'Nu am putut genera codul QR de fidelitate.'));
        setHasRequestedProfileQr(false);
        void fetchLoyaltySummary()
          .then((summary) => {
            setLoyalty(summary);
            setLoyaltyQrToken(summary.loyaltyQrToken ?? null);
            setVoucherQrToken(summary.lastVoucher?.qrToken ?? null);
          })
          .catch(() => undefined);
      });
  });

  const redeemVoucher = useStableCallback(() => {
    if (!accountUser) {
      openLogin();
      return;
    }
    if (loyalty.points < loyaltyRedeemPoints) {
      showToast('Nu ai suficiente puncte pentru valoarea selectată.', 'error');
      return;
    }
    setLoyaltyBusy(true);
    void redeemLoyaltyVoucher(loyaltyRedeemPoints)
      .then((payload) => {
        setLoyalty(payload.summary);
        setVoucherQrToken(payload.voucher.qrToken ?? null);
        haptics.success();
        showToast('Voucherul a fost generat. Îl poți scana la casă.');
        return fetchInbox();
      })
      .then((items) => setInbox(items))
      .catch((error) => showToast(errorMessage(error, 'Voucher indisponibil momentan.'), 'error'))
      .finally(() => setLoyaltyBusy(false));
  });

  const shareVoucher = useStableCallback(() => {
    if (!loyalty.lastVoucher?.code || !voucherQrToken) {
      showToast('Nu există voucher activ pentru partajare.', 'error');
      return;
    }
    void Share.share({
      message: `Voucher Dacus: ${loyalty.lastVoucher.code} · ${formatPrice(loyalty.lastVoucher.valueRon)} · Cod scanare: ${voucherQrToken}`,
    }).catch(() => showToast('Partajarea voucherului nu a reușit momentan.', 'error'));
  });

  const shareLoyaltyCode = useStableCallback(() => {
    if (!loyaltyQrToken) {
      showToast('Nu există cod de membru activ pentru partajare.', 'error');
      return;
    }
    void Share.share({ message: `Cod de membru fidelitate Dacus: ${loyaltyQrToken}` }).catch(() =>
      showToast('Partajarea codului de membru nu a reușit momentan.', 'error'),
    );
  });

  // ---- Settings -------------------------------------------------------------------------------

  const refreshServerAccountSettings = useStableCallback(async () => {
    if (!accountUser) return;
    setSettingsLoading(true);
    try {
      const nextSettings = await fetchAccountSettings();
      setServerAccountSettings(nextSettings);
      syncLocalPreferencesFromServerSettings(nextSettings);
    } catch {
      // Keep the settings already shown.
    } finally {
      setSettingsLoading(false);
    }
  });

  /** Saves settings to the account when signed in, otherwise on the device; throws on failure. */
  const updateSettings = useStableCallback(async (patch: AccountSettingsPatch) => {
    if (accountUser) {
      const nextSettings = await updateAccountSettings(patch);
      setServerAccountSettings(nextSettings);
      syncLocalPreferencesFromServerSettings(nextSettings);
      const displayName = patch.profile?.displayName?.trim();
      if (displayName) setAccountUser((current) => (current ? { ...current, name: displayName } : current));
      return;
    }

    const merged = mergeAccountSettings(localFallbackAccountSettings, patch);
    persistPreferences((current) => ({
      ...current,
      trustConsent: {
        analytics: merged.privacy.analyticsConsent.granted,
        personalization: merged.privacy.personalizationConsent.granted,
        marketing: merged.privacy.marketingConsent.granted,
        updatedAt: merged.updatedAt,
      },
      preferenceOnboarding: { ...current.preferenceOnboarding, marketingOptIn: merged.privacy.marketingConsent.granted },
      accountSettings: { ...current.accountSettings, marketingEmailsEnabled: merged.privacy.marketingConsent.granted },
    }));
  });

  const changePassword = useStableCallback(async (currentPassword: string, newPassword: string) => {
    if (!accountUser) throw new Error('Autentifică-te pentru schimbarea parolei.');
    await changePasswordRequest({ currentPassword, newPassword });
  });

  const toggleBiometricLogin = useStableCallback(async () => {
    if (localAccountSettings.biometricLoginEnabled) {
      setBiometricLogin(false);
      showToast('Login biometric dezactivat.');
      return;
    }

    const { isBiometricAvailable, authenticateWithBiometric } = await import('../services/biometric');
    if (!(await isBiometricAvailable())) {
      showToast('Autentificarea biometrică nu este disponibilă pe acest dispozitiv.', 'error');
      return;
    }
    const result = await authenticateWithBiometric('Activează loginul biometric');
    if (result.success) {
      setBiometricLogin(true);
      showToast('Login biometric activat.');
    } else {
      showToast(result.error || 'Nu am putut activa loginul biometric.', 'error');
    }
  });

  const toggleTrustConsent = useStableCallback((key: TrustConsentKey) => {
    persistPreferences((current) => ({
      ...current,
      trustConsent: { ...current.trustConsent, [key]: !current.trustConsent[key], updatedAt: new Date().toISOString() },
    }));
  });

  const toggleOnboardingBrand = useStableCallback((brand: string) => {
    persistPreferences((current) => {
      const set = new Set(current.preferenceOnboarding.favoriteBrands);
      if (set.has(brand)) set.delete(brand);
      else set.add(brand);
      return { ...current, preferenceOnboarding: { ...current.preferenceOnboarding, favoriteBrands: Array.from(set) } };
    });
  });

  const toggleOnboardingCategory = useStableCallback((categoryId: string) => {
    persistPreferences((current) => {
      const set = new Set(current.preferenceOnboarding.favoriteCategories);
      if (set.has(categoryId)) set.delete(categoryId);
      else set.add(categoryId);
      return {
        ...current,
        preferenceOnboarding: { ...current.preferenceOnboarding, favoriteCategories: Array.from(set) },
      };
    });
  });

  const toggleMarketingOptIn = useStableCallback(() => {
    persistPreferences((current) => ({
      ...current,
      preferenceOnboarding: {
        ...current.preferenceOnboarding,
        marketingOptIn: !current.preferenceOnboarding.marketingOptIn,
      },
    }));
  });

  const selectedAddress = addresses.find((item) => item.id === selectedAddressId) ?? null;
  const pendingOrdersCount = orders.filter((order) => order.status !== 'shipped').length;
  const unreadInboxCount = inbox.filter((item) => !item.readAt).length;

  return {
    // Catalog
    categories,
    products,
    productsById,
    countByCategory,
    productsByCategory,
    orderedCategories,
    departments,
    featuredCategories,
    homeSections,
    trendingSearches,
    continueBrowsingProducts,
    continueBrowsingCategories,
    trackProductView,
    trackCategoryView,
    // Cart & checkout
    cartItems,
    cartCount,
    cartTotal,
    deliveryEtaLabel,
    priceChangeExplanation,
    addToCart,
    changeQuantity,
    removeCartItem,
    savedCartLists,
    saveCurrentCartAsList,
    restoreCartList,
    removeSavedCartList,
    checkoutBusy,
    checkoutError,
    processCheckout,
    // Wishlist, alerts, compare, filters
    wishlist,
    wishlistProducts,
    toggleWishlist,
    backInStockSubscriptions,
    toggleBackInStockAlert,
    compareProductIds,
    compareProducts,
    toggleCompareProduct,
    clearCompareProducts,
    filterPresets,
    saveFilterPreset,
    deleteFilterPreset,
    // Search
    recentSearches,
    savedSearches,
    recentFilterSnapshots,
    recordSearch,
    clearRecentSearches,
    toggleSavedSearch,
    recordFilterSnapshot,
    // Account
    accountUser,
    authBusy,
    authError,
    clearAuthError,
    login,
    register,
    requestPasswordReset,
    deleteAccount,
    logout,
    orders,
    orderDetailsById,
    loadOrderDetails,
    pendingOrdersCount,
    inbox,
    unreadInboxCount,
    markInboxRead,
    addresses,
    selectedAddress,
    selectedAddressId,
    addressBusy,
    saveAddress,
    selectAddress,
    deleteAddress,
    deviceSessions,
    refreshDeviceSessions,
    revokeSession,
    // Loyalty
    loyalty,
    tierProgress,
    voucherValueRon,
    loyaltyBusy,
    loyaltyRefreshing,
    loyaltyRedeemPoints,
    setLoyaltyRedeemPoints,
    loyaltyQrToken,
    loyaltyQrLoading: hasRequestedProfileQr && !loyaltyQrToken && !profileQrError,
    profileQrError,
    voucherQrToken,
    refreshLoyalty,
    retryLoyaltyQr,
    redeemVoucher,
    shareVoucher,
    shareLoyaltyCode,
    // Settings & preferences
    effectiveAccountSettings,
    settingsLoading,
    refreshServerAccountSettings,
    updateSettings,
    changePassword,
    biometricLoginEnabled: localAccountSettings.biometricLoginEnabled,
    toggleBiometricLogin,
    trustConsent,
    toggleTrustConsent,
    preferenceOnboarding,
    toggleOnboardingBrand,
    toggleOnboardingCategory,
    toggleMarketingOptIn,
  };
}

export type AppState = ReturnType<typeof useAppState>;

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error('useApp must be used inside AppProvider');
  return state;
}

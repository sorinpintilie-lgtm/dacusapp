import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import QRCodeMatrix from './src/components/QRCodeMatrix';
import {
  Share,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import dacusLogo from './assets/icon.png';
import { AdvancedSearch } from './src/components/AdvancedSearch';
import ErrorBoundary from './src/components/ErrorBoundary';
import { type CatalogCategory, type CatalogProduct } from './src/data/catalog';
import { LoginScreen } from './src/components/LoginScreen';
import { ProductCard } from './src/components/ProductCard';
import { RegisterScreen } from './src/components/RegisterScreen';
import { Skeleton } from './src/components/Skeleton';
import { NavigationBar } from './src/components/NavigationBar';
import { useCatalog } from './src/hooks/useCatalog';
import { AccountScreen } from './src/screens/AccountScreen';
import { CartScreen } from './src/screens/CartScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoyaltyScreen } from './src/screens/LoyaltyScreen';
import { ProductDetailsScreen } from './src/screens/ProductDetailsScreen';
import { ProductsScreen } from './src/screens/ProductsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  changePassword,
  createAddress,
  deleteAddress,
  fetchAccountSettings,
  fetchBackInStockSubscriptions,
  checkoutCart,
  fetchAddresses,
  fetchCart,
  fetchDeviceSessions,
  fetchInbox,
  fetchLoyaltySummary,
  fetchOrderDetails,
  fetchOrders,
  fetchSearchSuggestions,
  fetchWishlist,
  generateLoyaltyQr,
  fetchProductSearch,
  loginAccount,
  logoutAccount,
  markInboxNotificationRead,
  removeCartLine,
  replaceCartLines,
  redeemLoyaltyVoucher,
  registerAccount,
  registerDeviceForNotifications,
  revokeDeviceSession,
  requestPasswordReset,
  restoreAccount,
  selectAddress,
  sendAnalyticsEvents,
  setBackInStockSubscription,
  setWishlistProduct,
  upsertCartLine,
  updateAddress,
  updateAccountSettings,
  validateCart,
  type AccountSettings,
  type AccountSettingsPatch,
  type Address,
  type AddressDraft,
  type CartLine,
  type DeviceSession,
  type InboxNotification,
  type LoyaltySummary,
  type OrderDetailsPayload,
  type Order,
  type SearchFacet,
} from './src/services/commerce';
import {
  getAppPreferences,
  updateAppPreferences,
  type AppPreferences,
} from './src/services/sessionStorage';
import { colors, radii, spacing, typography } from './src/theme/tokens';
import { appStyles } from './src/theme/styles';
import {
  filterProducts,
  formatPrice,
  type PriceFilterOption,
  type SortOption,
} from './src/utils/catalogFilters';

type Page =
  | 'home'
  | 'categories'
  | 'products'
  | 'productDetails'
  | 'cart'
  | 'loyalty'
  | 'account'
  | 'settings'
  | 'login'
  | 'register';
type LoyaltyTierName = 'Bronze' | 'Silver' | 'Gold';

const loyaltyTiers: Array<{ name: LoyaltyTierName; min: number; max: number }> = [
  { name: 'Bronze', min: 0, max: 1499 },
  { name: 'Silver', min: 1500, max: 4999 },
  { name: 'Gold', min: 5000, max: Number.POSITIVE_INFINITY },
];

const loyaltyTierBenefits: Record<LoyaltyTierName, string> = {
  Bronze: 'Acumulare standard de puncte È™i acces la vouchere de bazÄƒ.',
  Silver: 'Prioritate la campanii È™i oferte dedicate membrilor Silver.',
  Gold: 'Beneficii premium, prioritate maximÄƒ È™i suport preferenÈ›ial.',
};

const HOME_SECTIONS_LIMIT = 6;
const PRODUCTS_PAGE_SIZE = 48;
const CONTINUE_BROWSING_LIMIT = 18;
const COMPARE_PRODUCTS_LIMIT = 4;

const defaultLoyalty: LoyaltySummary = {
  points: 0,
  tier: 'Bronze',
  nextTierSpendRon: 1500,
};

const orderStatusLabels: Record<Order['status'], string> = {
  created: 'ComandÄƒ plasatÄƒ',
  processing: 'ÃŽn procesare',
  shipped: 'ExpediatÄƒ',
};

const standaloneAuthPages: Page[] = ['login', 'register'];

const isStandaloneAuthPage = (value: Page) => standaloneAuthPages.includes(value);

const authScreenTitles: Record<'login' | 'register', string> = {
  login: 'Autentificare',
  register: 'CreeazÄƒ cont',
};

const authScreenSubtitles: Record<'login' | 'register', string> = {
  login: 'ConecteazÄƒ-te pentru a accesa comenzile, punctele È™i notificÄƒrile.',
  register: 'CreeazÄƒ un cont nou pentru o experienÈ›Äƒ completÄƒ Ã®n aplicaÈ›ie.',
};

const stripCategoryPrefixes = (value: string) => value.replace(/^product-type-/i, '');

const normalizeCategoryToken = (value: string) =>
  stripCategoryPrefixes(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

const isBroadCategoryName = (value: string) => {
  const token = normalizeCategoryToken(value);
  return (
    token.length === 0 ||
    token === 'diverse' ||
    token === 'divers' ||
    token === 'all' ||
    token === 'toate' ||
    token === 'uncategorized' ||
    token.startsWith('general')
  );
};

const pickBestCategoryForHome = (
  categories: CatalogCategory[],
  products: CatalogProduct[],
  limit: number,
) => {
  const countByCategory = new Map<string, number>();

  products.forEach((item) => {
    countByCategory.set(item.categoryId, (countByCategory.get(item.categoryId) ?? 0) + 1);
  });

  return categories
    .map((category) => ({ category, count: countByCategory.get(category.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      const broadDiff =
        Number(isBroadCategoryName(a.category.name)) - Number(isBroadCategoryName(b.category.name));
      if (broadDiff !== 0) return broadDiff;
      if (b.count !== a.count) return b.count - a.count;
      return a.category.name.localeCompare(b.category.name, 'ro');
    })
    .slice(0, limit)
    .map((item) => item.category);
};

const hasImageUrl = (value: string | undefined): value is string =>
  !!value && /^https?:\/\//.test(value);

const extractVendorsFromFacets = (facets: SearchFacet[] | undefined) => {
  const vendorFacet = (facets ?? []).find((facet) => facet.field_name === 'vendor');
  return (vendorFacet?.counts ?? [])
    .map((item) => item.value)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
};

type AccountSegment = 'profile' | 'orders' | 'addresses' | 'privacy' | 'journey';

type RecentFilterSnapshot = {
  id: string;
  label: string;
  brandFilter: string;
  priceFilter: PriceFilterOption;
  onlyDiscount: boolean;
  onlyInStock: boolean;
  sortOption: SortOption;
  facetCategoryId: string;
};

const buildInitialAddressDraft = (name = ''): AddressDraft => ({
  label: '',
  fullName: name,
  phone: '',
  line1: '',
  line2: '',
  city: '',
  county: '',
  postalCode: '',
  countryCode: 'RO',
});

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
};

const formatPostalCodeInput = (value: string) => value.replace(/\D/g, '').slice(0, 6);

const getAddressQualityScore = (draft: AddressDraft) => {
  let score = 0;
  if (draft.label.trim().length >= 3) score += 10;
  if (draft.fullName.trim().length >= 5) score += 20;
  if (draft.phone.replace(/\D/g, '').length >= 9) score += 20;
  if (draft.line1.trim().length >= 8) score += 20;
  if (draft.city.trim().length >= 2) score += 10;
  if (draft.county.trim().length >= 2) score += 10;
  if (draft.postalCode.trim().length >= 6) score += 5;
  if (draft.countryCode.trim().length === 2) score += 5;
  return Math.min(100, score);
};

const buildFallbackCartProduct = (line: CartLine): CatalogProduct => {
  const fallbackPrice =
    typeof line.unitPriceRon === 'number' && Number.isFinite(line.unitPriceRon)
      ? Number(line.unitPriceRon.toFixed(2))
      : 0;
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

const buildFilterSummaryLabel = (input: {
  brandFilter: string;
  priceFilter: PriceFilterOption;
  onlyDiscount: boolean;
  onlyInStock: boolean;
  sortOption: SortOption;
}) => {
  const chunks: string[] = [];
  if (input.brandFilter !== 'toate') chunks.push(`Brand ${input.brandFilter}`);
  if (input.priceFilter !== 'toate') chunks.push(`PreÈ› ${input.priceFilter}`);
  if (input.onlyDiscount) chunks.push('PromoÈ›ii');
  if (!input.onlyInStock) chunks.push('Include stoc epuizat');
  if (input.sortOption !== 'relevanta') chunks.push(`Sort ${input.sortOption}`);
  return chunks.join(' Â· ');
};

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    categories,
    products,
    selectedCategory,
    selectedCategoryId,
    selectedProduct,
    selectedProductId,
    setSelectedCategoryId,
    setSelectedProductId,
    productsById,
    countByCategory,
    catalogError,
    catalogLoading,
    setCatalogError,
    setCatalogMeta,
    upsertProducts,
  } = useCatalog();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [accountUser, setAccountUser] = useState<{
    id: string;
    email: string;
    name: string;
  } | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderDetailsById, setOrderDetailsById] = useState<Record<string, OrderDetailsPayload>>({});
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [recentFilterSnapshots, setRecentFilterSnapshots] = useState<RecentFilterSnapshot[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [inbox, setInbox] = useState<InboxNotification[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(defaultLoyalty);
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [loyaltyRefreshing, setLoyaltyRefreshing] = useState(false);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(100);
  const [loyaltyQrToken, setLoyaltyQrToken] = useState<string | null>(null);
  const [voucherQrToken, setVoucherQrToken] = useState<string | null>(null);
  const [qrModalToken, setQrModalToken] = useState<string | null>(null);
  const [hasRequestedProfileQr, setHasRequestedProfileQr] = useState(false);
  const [profileQrError, setProfileQrError] = useState<string | null>(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>('toate');
  const [priceFilter, setPriceFilter] = useState<PriceFilterOption>('toate');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('relevanta');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [authRedirectPage, setAuthRedirectPage] = useState<Page | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<CatalogProduct[]>([]);
  const [searchFacets, setSearchFacets] = useState<SearchFacet[]>([]);
  const [facetCategoryId, setFacetCategoryId] = useState('');
  const [searchVendors, setSearchVendors] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [undoRemoval, setUndoRemoval] = useState<{ line: CartLine; productName: string } | null>(
    null,
  );
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressEditorVisible, setAddressEditorVisible] = useState(false);
  const [addressEditorId, setAddressEditorId] = useState<string | null>(null);
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(() => buildInitialAddressDraft());
  const [homeSnapshot, setHomeSnapshot] = useState<{
    categories: CatalogCategory[];
    products: CatalogProduct[];
  } | null>(null);
  const [appPreferences, setAppPreferencesState] = useState<AppPreferences | null>(null);
  const [backInStockSubscriptions, setBackInStockSubscriptions] = useState<Set<string>>(new Set());
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [deviceId] = useState(
    () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [accountSegment, setAccountSegment] = useState<AccountSegment>('profile');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [shouldPromptBiometricAfterAuth, setShouldPromptBiometricAfterAuth] = useState(false);
  const [serverAccountSettings, setServerAccountSettings] = useState<AccountSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    console.log('[BOOT][AppContent] mounted');
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const pageScrollOffsetsRef = useRef<Record<Page, number>>({
    home: 0,
    categories: 0,
    products: 0,
    productDetails: 0,
    cart: 0,
    loyalty: 0,
    account: 0,
    settings: 0,
    login: 0,
    register: 0,
  });
  const productPageEntryRef = useRef<{ page: Page; scrollY: number } | null>(null);
  const restoringScrollRef = useRef(false);
  const viewport = Dimensions.get('window');
  const zoomCloseTop = spacing.lg;

  const persistPreferences = (updater: (current: AppPreferences) => AppPreferences) => {
    void updateAppPreferences(updater)
      .then((next) => setAppPreferencesState(next))
      .catch(() => undefined);
  };

  const favoriteCategoryIds = useMemo(
    () => appPreferences?.favoriteCategoryIds ?? [],
    [appPreferences?.favoriteCategoryIds],
  );
  const compareProductIds = useMemo(
    () => appPreferences?.compareProductIds ?? [],
    [appPreferences?.compareProductIds],
  );
  const filterPresets = appPreferences?.filterPresets ?? [];
  const savedCartLists = appPreferences?.savedCartLists ?? [];
  const trustConsent = appPreferences?.trustConsent ?? {
    analytics: true,
    personalization: true,
    marketing: false,
    updatedAt: new Date(0).toISOString(),
  };
  const preferenceOnboarding = appPreferences?.preferenceOnboarding ?? {
    completed: false,
    favoriteBrands: [] as string[],
    favoriteCategories: [] as string[],
    marketingOptIn: false,
  };
  const accountSettings = appPreferences?.accountSettings ?? {
    biometricLoginEnabled: false,
    biometricPromptShown: false,
    marketingEmailsEnabled: preferenceOnboarding.marketingOptIn,
  };

  const localFallbackAccountSettings = useMemo<AccountSettings>(
    () => ({
      schemaVersion: 1,
      updatedAt: trustConsent.updatedAt,
      profile: {
        displayName: accountUser?.name ?? '',
        locale: 'ro-RO',
      },
      notifications: {
        email: {
          marketing: trustConsent.marketing,
          orderUpdates: true,
          securityAlerts: true,
        },
        push: {
          marketing: trustConsent.marketing,
          orderUpdates: true,
          securityAlerts: true,
          backInStock: true,
        },
        inApp: {
          marketing: trustConsent.marketing,
          orderUpdates: true,
          securityAlerts: true,
        },
      },
      privacy: {
        analyticsConsent: {
          granted: trustConsent.analytics,
          updatedAt: trustConsent.updatedAt,
          source: 'local_preferences',
        },
        personalizationConsent: {
          granted: trustConsent.personalization,
          updatedAt: trustConsent.updatedAt,
          source: 'local_preferences',
        },
        marketingConsent: {
          granted: trustConsent.marketing,
          updatedAt: trustConsent.updatedAt,
          source: 'local_preferences',
        },
      },
      security: {
        loginAlerts: true,
        twoFactorEnabled: false,
      },
    }),
    [
      accountUser?.name,
      trustConsent.analytics,
      trustConsent.marketing,
      trustConsent.personalization,
      trustConsent.updatedAt,
    ],
  );

  const effectiveAccountSettings = serverAccountSettings ?? localFallbackAccountSettings;

  const isLoading = catalogLoading;
  const homeCategories = homeSnapshot?.categories ?? categories;
  const homeProducts = homeSnapshot?.products ?? products;

  const isCollectionScopedView = page === 'products' && searchQuery.trim().length === 0;

  const localCollectionFilteredResults = useMemo(() => {
    if (!isCollectionScopedView) return [] as CatalogProduct[];

    const collectionProducts = products.filter((item) => {
      if (Array.isArray(item.categoryIds) && item.categoryIds.length > 0) {
        return item.categoryIds.includes(selectedCategoryId);
      }

      return item.categoryId === selectedCategoryId;
    });
    if (collectionProducts.length === 0) return [] as CatalogProduct[];

    return filterProducts(collectionProducts, {
      query: '',
      brandFilter,
      priceFilter,
      onlyDiscount,
      onlyInStock,
      sortOption,
    });
  }, [
    brandFilter,
    isCollectionScopedView,
    onlyDiscount,
    onlyInStock,
    priceFilter,
    products,
    selectedCategoryId,
    sortOption,
  ]);

  const shouldUseLocalCollectionFallback =
    isCollectionScopedView &&
    searchResults.length === 0 &&
    productsTotal === 0 &&
    (countByCategory.get(selectedCategoryId) ?? 0) > 0 &&
    localCollectionFilteredResults.length > 0;

  const productsResultsSource = useMemo(
    () => (shouldUseLocalCollectionFallback ? localCollectionFilteredResults : searchResults),
    [localCollectionFilteredResults, searchResults, shouldUseLocalCollectionFallback],
  );

  const productsTotalForView = shouldUseLocalCollectionFallback
    ? localCollectionFilteredResults.length
    : productsTotal;
  const productsHasMoreForView = shouldUseLocalCollectionFallback ? false : productsHasMore;

  const availableBrands = useMemo(
    () =>
      (searchVendors.length > 0 && !shouldUseLocalCollectionFallback
        ? searchVendors.filter(
            (item): item is string => typeof item === 'string' && item.length > 0,
          )
        : Array.from(
            new Set(
              productsResultsSource
                .map((item) => item.brand)
                .filter((item): item is string => typeof item === 'string' && item.length > 0),
            ).values(),
          )
      ).sort((a, b) => a.localeCompare(b, 'ro')),
    [productsResultsSource, searchVendors, shouldUseLocalCollectionFallback],
  );

  const brandFacetCounts = useMemo(() => {
    const facet = searchFacets.find((item) => item.field_name === 'vendor');
    return (facet?.counts ?? []).reduce<Record<string, number>>((acc, item) => {
      acc[item.value] = item.count;
      return acc;
    }, {});
  }, [searchFacets]);

  const categoryFacetOptions = useMemo(() => {
    const facet = searchFacets.find((item) => item.field_name === 'categoryId');
    return (facet?.counts ?? []).map((item) => ({
      id: item.value,
      label: categories.find((category) => category.id === item.value)?.name ?? item.value,
      count: item.count,
      active: (facetCategoryId || selectedCategoryId) === item.value,
    }));
  }, [categories, facetCategoryId, searchFacets, selectedCategoryId]);

  const availabilityFacetCounts = useMemo(() => {
    const facet = searchFacets.find((item) => item.field_name === 'availableForSale');
    return (facet?.counts ?? []).reduce(
      (acc, item) => {
        const normalized = typeof item.value === 'string' ? item.value.trim().toLowerCase() : '';
        if (normalized === 'true' || normalized === '1') {
          acc.inStock += item.count;
        } else {
          acc.outOfStock += item.count;
        }
        return acc;
      },
      { inStock: 0, outOfStock: 0 },
    );
  }, [searchFacets]);

  const facetConfidenceHints = useMemo<
    Array<{ label: string; tone: 'success' | 'warning' | 'info' | 'danger' }>
  >(() => {
    const hints: Array<{ label: string; tone: 'success' | 'warning' | 'info' | 'danger' }> = [];
    const visibleCount = productsResultsSource.length;
    if (visibleCount > 0 && visibleCount <= 8) {
      hints.push({ label: 'Rezultate puÈ›ine â€” Ã®ncearcÄƒ filtre mai largi', tone: 'warning' });
    }
    if (availabilityFacetCounts.inStock > 0 && availabilityFacetCounts.outOfStock === 0) {
      hints.push({ label: 'Stoc excelent pentru selecÈ›ia curentÄƒ', tone: 'success' });
    }
    if (availabilityFacetCounts.outOfStock > availabilityFacetCounts.inStock) {
      hints.push({ label: 'Multe produse au stoc limitat', tone: 'danger' });
    }
    if (searchQuery.trim().length > 0 && visibleCount > 20) {
      hints.push({ label: 'Rezultate bogate â€” foloseÈ™te filtre inteligente', tone: 'info' });
    }
    return hints.slice(0, 3);
  }, [
    availabilityFacetCounts.inStock,
    availabilityFacetCounts.outOfStock,
    productsResultsSource.length,
    searchQuery,
  ]);

  const filteredProducts = useMemo(() => {
    if (page !== 'products') return [];
    if (!onlyFavorites) return productsResultsSource;
    return productsResultsSource.filter((product) => wishlist.has(product.id));
  }, [onlyFavorites, page, productsResultsSource, wishlist]);

  const cartItems = useMemo(
    () =>
      cart.reduce<
        Array<
          CartLine & {
            product: CatalogProduct;
            unitPriceRon: number;
            variantName?: string;
            stockRiskLabel?: string;
          }
        >
      >((acc, line) => {
        const product = productsById.get(line.productId) ?? buildFallbackCartProduct(line);
        const variant = line.variantId
          ? product.variants?.find((item) => item.id === line.variantId)
          : undefined;
        const normalizedStock = (
          typeof product.stockLabel === 'string' ? product.stockLabel : ''
        ).toLowerCase();
        const stockRiskLabel =
          normalizedStock.includes('limitat') || normalizedStock.includes('ultim')
            ? 'Risc stoc: ridicat'
            : normalizedStock.includes('indisponibil') || normalizedStock.includes('epuizat')
              ? 'Risc stoc: critic'
              : 'Risc stoc: redus';
        const resolvedUnitPriceRon =
          typeof line.unitPriceRon === 'number' && Number.isFinite(line.unitPriceRon)
            ? Number(line.unitPriceRon.toFixed(2))
            : (variant?.priceRon ?? product.priceRon);

        acc.push({
          ...line,
          product,
          unitPriceRon: resolvedUnitPriceRon,
          ...(variant?.name
            ? { variantName: variant.name }
            : line.variantId
              ? { variantName: `Varianta ${line.variantId}` }
              : {}),
          stockRiskLabel,
        });
        return acc;
      }, []),
    [cart, productsById],
  );

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.unitPriceRon * item.quantity, 0);
  const deliveryEtaLabel = useMemo(() => {
    if (cartItems.length === 0) return 'AdaugÄƒ produse pentru estimare livrare.';
    const hasHighRisk = cartItems.some(
      (item) => item.stockRiskLabel?.includes('critic') || item.stockRiskLabel?.includes('ridicat'),
    );
    return hasHighRisk
      ? 'ETA livrare: 2-4 zile lucrÄƒtoare (stoc variabil)'
      : 'ETA livrare: 24-48h pentru majoritatea produselor';
  }, [cartItems]);

  const priceChangeExplanation = useMemo(() => {
    const changed = cartItems.filter((item) => {
      const base = item.product.priceRon;
      return Math.abs(item.unitPriceRon - base) >= 0.01;
    });
    if (changed.length === 0) return null;
    return `${changed.length} produs(e) au preÈ› actualizat Ã®n coÈ™ (promoÈ›ii sau variantÄƒ selectatÄƒ).`;
  }, [cartItems]);

  const addressQualityScore = useMemo(() => getAddressQualityScore(addressDraft), [addressDraft]);

  const pendingOrdersCount = useMemo(
    () => orders.filter((order) => order.status !== 'shipped').length,
    [orders],
  );
  const unreadInboxCount = useMemo(() => inbox.filter((item) => !item.readAt).length, [inbox]);
  const selectedAddress = useMemo(
    () => addresses.find((item) => item.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const resolveUnitPriceRon = (productId: string, variantId?: string): number | null => {
    const product = productsById.get(productId);
    if (!product) return null;
    const variant = variantId ? product.variants?.find((item) => item.id === variantId) : undefined;
    const amount = variant?.priceRon ?? product.priceRon;
    if (!Number.isFinite(amount)) return null;
    return Number(amount.toFixed(2));
  };

  const sectionsByCategory = useMemo(() => {
    const byCategory = new Map<string, CatalogProduct[]>();
    homeProducts.forEach((item) => {
      const list = byCategory.get(item.categoryId);
      if (list) {
        list.push(item);
      } else {
        byCategory.set(item.categoryId, [item]);
      }
    });

    const preferredCategories = pickBestCategoryForHome(
      homeCategories,
      homeProducts,
      HOME_SECTIONS_LIMIT * 2,
    );

    return preferredCategories
      .map((category) => ({ category, products: byCategory.get(category.id) ?? [] }))
      .filter((section) => section.products.length > 0)
      .slice(0, HOME_SECTIONS_LIMIT);
  }, [homeCategories, homeProducts]);

  const featuredCategories = useMemo(
    () => pickBestCategoryForHome(homeCategories, homeProducts, HOME_SECTIONS_LIMIT),
    [homeCategories, homeProducts],
  );

  const trendingSearches = useMemo(
    () =>
      Array.from(
        new Set([
          ...featuredCategories.map((item) => item.name),
          ...homeProducts.slice(0, 4).map((item) => item.brand),
        ]).values(),
      ).slice(0, 8),
    [featuredCategories, homeProducts],
  );

  const continueBrowsingProducts = useMemo(() => {
    const ids = appPreferences?.continueBrowsingProductIds ?? [];
    return ids
      .map((id) => productsById.get(id))
      .filter((item): item is CatalogProduct => !!item)
      .slice(0, 8);
  }, [appPreferences?.continueBrowsingProductIds, productsById]);

  const continueBrowsingCategories = useMemo(() => {
    const ids = new Set(appPreferences?.continueBrowsingCategoryIds ?? []);
    return categories.filter((item) => ids.has(item.id));
  }, [appPreferences?.continueBrowsingCategoryIds, categories]);

  const compareProducts = useMemo(
    () =>
      compareProductIds
        .map((id) => productsById.get(id))
        .filter((item): item is CatalogProduct => !!item),
    [compareProductIds, productsById],
  );
  const compareProductIdSet = useMemo(() => new Set(compareProductIds), [compareProductIds]);

  const orderedCategoriesForView = useMemo(() => {
    const favorites = new Set(favoriteCategoryIds);
    const ranked = categories.map((category) => ({
      category,
      favorite: favorites.has(category.id),
      productsCount: countByCategory.get(category.id) ?? 0,
      discountCount: products.filter(
        (item) => item.categoryId === category.id && (item.oldPriceRon ?? 0) > item.priceRon,
      ).length,
      inStockRate:
        products.filter((item) => item.categoryId === category.id).length > 0
          ? Math.round(
              (products.filter(
                (item) =>
                  item.categoryId === category.id &&
                  (typeof item.stockLabel === 'string' ? item.stockLabel : '')
                    .toLowerCase()
                    .includes('stoc'),
              ).length /
                Math.max(1, products.filter((item) => item.categoryId === category.id).length)) *
                100,
            )
          : 0,
    }));

    return ranked.sort((a, b) => {
      if (a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
      if (b.productsCount !== a.productsCount) return b.productsCount - a.productsCount;
      return a.category.name.localeCompare(b.category.name, 'ro');
    });
  }, [categories, countByCategory, favoriteCategoryIds, products]);
  const similarProducts = useMemo(() => {
    if (!selectedProduct) return [];

    const sameCategory = products.filter(
      (item) => item.id !== selectedProduct.id && item.categoryId === selectedProduct.categoryId,
    );

    return [...sameCategory]
      .sort((a, b) => {
        const aDiscount = (a.oldPriceRon ?? 0) > a.priceRon ? 1 : 0;
        const bDiscount = (b.oldPriceRon ?? 0) > b.priceRon ? 1 : 0;
        if (bDiscount !== aDiscount) return bDiscount - aDiscount;

        const aDelta = Math.abs((a.priceRon ?? 0) - (selectedProduct.priceRon ?? 0));
        const bDelta = Math.abs((b.priceRon ?? 0) - (selectedProduct.priceRon ?? 0));
        if (aDelta !== bDelta) return aDelta - bDelta;

        return (a.name ?? '').localeCompare(b.name ?? '', 'ro');
      })
      .slice(0, 8);
  }, [products, selectedProduct]);

  const upsellProducts = useMemo(() => {
    if (!selectedProduct) return [];

    const excludedIds = new Set([selectedProduct.id, ...similarProducts.map((item) => item.id)]);
    const targetPrice = selectedProduct.priceRon ?? 0;

    const premiumSameBrand = products
      .filter(
        (item) =>
          !excludedIds.has(item.id) &&
          item.brand === selectedProduct.brand &&
          (item.priceRon ?? 0) >= targetPrice &&
          item.categoryId !== selectedProduct.categoryId,
      )
      .sort((a, b) => (a.priceRon ?? 0) - (b.priceRon ?? 0));

    const promotedAlternatives = products
      .filter(
        (item) =>
          !excludedIds.has(item.id) &&
          item.categoryId !== selectedProduct.categoryId &&
          (item.oldPriceRon ?? 0) > (item.priceRon ?? 0),
      )
      .sort((a, b) => {
        const aSavings = (a.oldPriceRon ?? a.priceRon ?? 0) - (a.priceRon ?? 0);
        const bSavings = (b.oldPriceRon ?? b.priceRon ?? 0) - (b.priceRon ?? 0);
        if (bSavings !== aSavings) return bSavings - aSavings;
        return (a.priceRon ?? 0) - (b.priceRon ?? 0);
      });

    const ordered = [...premiumSameBrand, ...promotedAlternatives];
    const uniqueById = Array.from(new Map(ordered.map((item) => [item.id, item])).values());
    return uniqueById.slice(0, 8);
  }, [products, selectedProduct, similarProducts]);

  const bundleProducts = useMemo(() => {
    if (!selectedProduct) return [];

    return products
      .filter(
        (item) =>
          item.id !== selectedProduct.id &&
          item.categoryId !== selectedProduct.categoryId &&
          item.brand === selectedProduct.brand,
      )
      .slice(0, 3);
  }, [products, selectedProduct]);

  const filterCount =
    Number(brandFilter !== 'toate') +
    Number(priceFilter !== 'toate') +
    Number(onlyDiscount) +
    Number(!onlyInStock) +
    Number(onlyFavorites) +
    Number(sortOption !== 'relevanta') +
    Number(facetCategoryId.length > 0);

  const sortLabelMap: Record<SortOption, string> = {
    relevanta: 'RelevanÈ›Äƒ',
    pretCrescator: 'PreÈ› crescÄƒtor',
    pretDescrescator: 'PreÈ› descrescÄƒtor',
    numeAZ: 'Nume A-Z',
  };

  useEffect(() => {
    void getAppPreferences()
      .then((prefs) => setAppPreferencesState(prefs))
      .catch(() => setAppPreferencesState(null));
  }, []);

  useEffect(() => {
    if (brandFilter !== 'toate' && !availableBrands.includes(brandFilter)) {
      setBrandFilter('toate');
    }
  }, [availableBrands, brandFilter]);

  useEffect(() => {
    if (!accountUser) {
      setAccountSegment('profile');
      setAddressEditorVisible(false);
      setAddressEditorId(null);
      setAddressFormError(null);
      setAddressDraft(buildInitialAddressDraft());
      setServerAccountSettings(null);
    }
  }, [accountUser]);

  const syncLocalPreferencesFromServerSettings = useCallback((settings: AccountSettings) => {
    const updatedAt = settings.updatedAt || new Date().toISOString();
    persistPreferences((current) => ({
      ...current,
      trustConsent: {
        analytics: settings.privacy.analyticsConsent.granted,
        personalization: settings.privacy.personalizationConsent.granted,
        marketing: settings.privacy.marketingConsent.granted,
        updatedAt,
      },
      preferenceOnboarding: {
        ...current.preferenceOnboarding,
        marketingOptIn: settings.privacy.marketingConsent.granted,
      },
      accountSettings: {
        ...current.accountSettings,
        marketingEmailsEnabled: settings.privacy.marketingConsent.granted,
      },
    }));
  }, []);

  const refreshServerAccountSettings = useCallback(async () => {
    if (!accountUser) return;
    setSettingsLoading(true);
    try {
      const nextSettings = await fetchAccountSettings();
      setServerAccountSettings(nextSettings);
      syncLocalPreferencesFromServerSettings(nextSettings);
    } finally {
      setSettingsLoading(false);
    }
  }, [accountUser, syncLocalPreferencesFromServerSettings]);

  useEffect(() => {
    if (page !== 'settings' || !accountUser) return;
    if (serverAccountSettings) return;
    void refreshServerAccountSettings().catch(() => undefined);
  }, [accountUser, page, refreshServerAccountSettings, serverAccountSettings]);

  useEffect(() => {
    if (!accountUser) {
      setHasRequestedProfileQr(false);
      setProfileQrError(null);
    }
  }, [accountUser]);

  useEffect(() => {
    if (!accountUser || loyaltyQrToken || hasRequestedProfileQr || profileQrError) return;

    console.log('[BOOT][AuthHydration] starting loyalty QR generation', {
      accountUserId: accountUser.id,
      hasToken: Boolean(loyaltyQrToken),
      hasRequestedProfileQr,
      hasProfileQrError: Boolean(profileQrError),
    });

    setHasRequestedProfileQr(true);
    setProfileQrError(null);
    void generateLoyaltyQr()
      .then((payload) => {
        console.log('[BOOT][AuthHydration] loyalty QR generation succeeded', {
          hasQrToken: Boolean(payload.qrToken),
          tier: payload.summary?.tier,
          points: payload.summary?.points,
        });
        setLoyalty(payload.summary);
        setLoyaltyQrToken(payload.qrToken);
        setHasRequestedProfileQr(true);
        setCatalogMeta('Codul de membru este pregÄƒtit pentru scanare.');
      })
      .catch((error) => {
        console.error('[BOOT][AuthHydration] loyalty QR generation failed', error);
        setHasRequestedProfileQr(false);
        const message =
          error instanceof Error ? error.message : 'Nu am putut genera codul QR de fidelitate.';
        setProfileQrError(message);
      });
  }, [accountUser, hasRequestedProfileQr, loyaltyQrToken, profileQrError, setCatalogMeta]);

  useEffect(() => {
    if (homeSnapshot) return;
    if (categories.length === 0 || products.length === 0) return;

    setHomeSnapshot({
      categories: [...categories],
      products: [...products],
    });
  }, [categories, homeSnapshot, products]);

  useEffect(() => {
    setShowBackTop((pageScrollOffsetsRef.current[page] ?? 0) > 420);
  }, [page]);

  useEffect(() => {
    if (page !== 'productDetails') return;
    const raf = requestAnimationFrame(() => {
      restoringScrollRef.current = true;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      pageScrollOffsetsRef.current.productDetails = 0;
      setShowBackTop(false);
      setTimeout(() => {
        restoringScrollRef.current = false;
      }, 60);
    });

    return () => cancelAnimationFrame(raf);
  }, [page, selectedProductId]);

  useEffect(() => {
    void restoreAccount().then((user) => {
      if (!user) return;
      console.log('[BOOT][AuthHydration] restoreAccount succeeded', {
        userId: user.id,
        email: user.email,
      });
      setAccountUser(user);
      void Promise.all([
        fetchCart(),
        fetchOrders(),
        fetchWishlist(),
        fetchInbox(),
        fetchLoyaltySummary(),
        fetchAddresses(),
        fetchBackInStockSubscriptions(),
        fetchDeviceSessions(deviceId),
        fetchAccountSettings().catch(() => null),
      ])
        .then(
          ([
            cartLines,
            orderItems,
            wishlistIds,
            inboxItems,
            loyaltySummary,
            addressPayload,
            subscribedIds,
            sessions,
            settingsPayload,
          ]) => {
            console.log('[BOOT][AuthHydration] post-auth bootstrap payload summary', {
              cartLines: cartLines.length,
              orders: orderItems.length,
              wishlist: wishlistIds.length,
              inbox: inboxItems.length,
              loyaltyTier: loyaltySummary.tier,
              loyaltyPoints: loyaltySummary.points,
              addresses: addressPayload.addresses.length,
              subscribedProducts: subscribedIds.length,
              sessions: sessions.length,
            });
            setCart(cartLines);
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
            if (settingsPayload) {
              setServerAccountSettings(settingsPayload);
              syncLocalPreferencesFromServerSettings(settingsPayload);
            }
          },
        )
        .catch((error) => {
          console.error('[BOOT][AuthHydration] post-auth bootstrap failed', error);
        });
    });
  }, [deviceId, syncLocalPreferencesFromServerSettings]);

  useEffect(() => {
    const variants = selectedProduct?.variants ?? [];
    if (variants.length === 0) {
      if (selectedVariantId !== '') setSelectedVariantId('');
      return;
    }

    if (!variants.some((item) => item.id === selectedVariantId)) {
      setSelectedVariantId(variants[0]?.id ?? '');
    }
  }, [selectedProduct, selectedVariantId]);

  useEffect(() => {
    if (page !== 'products') return;

    setProductsPage(1);
    setProductsHasMore(false);
    setProductsLoadingMore(true);

    const mapPriceFilter = (value: PriceFilterOption): { min?: number; max?: number } => {
      if (value === 'sub200') return { max: 199 };
      if (value === 'intre200si500') return { min: 200, max: 500 };
      if (value === 'intre500si1000') return { min: 501, max: 1000 };
      if (value === 'peste1000') return { min: 1001 };
      return {};
    };

    const priceRange = mapPriceFilter(priceFilter);

    const requestPerPage =
      searchQuery.trim().length > 0 ? PRODUCTS_PAGE_SIZE * 2 : PRODUCTS_PAGE_SIZE;
    const effectiveCategoryId =
      searchQuery.trim().length === 0 ? selectedCategoryId : facetCategoryId || undefined;

    void fetchProductSearch({
      query: searchQuery,
      page: 1,
      perPage: requestPerPage,
      sortBy: sortOption,
      ...(effectiveCategoryId ? { categoryId: effectiveCategoryId } : {}),
      ...(brandFilter !== 'toate' ? { vendor: brandFilter } : {}),
      onlyInStock,
      onlyDiscount,
      ...(typeof priceRange.min === 'number' ? { priceMin: priceRange.min } : {}),
      ...(typeof priceRange.max === 'number' ? { priceMax: priceRange.max } : {}),
      includeFacets: true,
    })
      .then((payload) => {
        const loadedProducts = payload.products;
        setProductsTotal(payload.total);
        setProductsHasMore(payload.hasMore);
        setSearchResults(loadedProducts);
        upsertProducts(loadedProducts);
        setSearchFacets(payload.facets ?? []);
        setSearchVendors(extractVendorsFromFacets(payload.facets));
      })
      .catch((error) => {
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'CÄƒutarea rapidÄƒ este indisponibilÄƒ momentan.',
        );
        setSearchResults([]);
        setProductsHasMore(false);
        setSearchFacets([]);
        setSearchVendors([]);
      })
      .finally(() => setProductsLoadingMore(false));
  }, [
    brandFilter,
    facetCategoryId,
    onlyDiscount,
    onlyInStock,
    page,
    priceFilter,
    searchQuery,
    selectedCategoryId,
    setCatalogError,
    sortOption,
    upsertProducts,
  ]);

  useEffect(() => {
    if (!toastMessage) return;

    const timeout = setTimeout(() => {
      setToastMessage(null);
    }, 2800);

    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!undoRemoval) return;
    const timeout = setTimeout(() => {
      setUndoRemoval(null);
    }, 4200);
    return () => clearTimeout(timeout);
  }, [undoRemoval]);

  useEffect(() => {
    if (page !== 'products' && compareMode) {
      setCompareMode(false);
    }
  }, [compareMode, page]);

  useEffect(() => {
    if (!shouldPromptBiometricAfterAuth || appPreferences === null) return;
    if (!accountSettings.biometricPromptShown) {
      setShowBiometricPrompt(true);
    }
    setShouldPromptBiometricAfterAuth(false);
  }, [accountSettings.biometricPromptShown, appPreferences, shouldPromptBiometricAfterAuth]);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastTone(tone);
    setToastMessage(message);
  };

  const currentTierTarget = useMemo(() => {
    if (loyalty.tier === 'Gold') return 5000;
    if (loyalty.tier === 'Silver') return 5000;
    return 1500;
  }, [loyalty.tier]);

  const estimatedCurrentSpend = Math.max(0, currentTierTarget - loyalty.nextTierSpendRon);
  const tierProgress =
    loyalty.tier === 'Gold' ? 1 : Math.min(1, estimatedCurrentSpend / currentTierTarget);
  const voucherValueRon = loyalty.lastVoucher?.valueRon ?? Math.floor(loyalty.points / 100) * 5;

  const addToCart = (productId: string) => {
    if (!productId) return;

    const product = productsById.get(productId);
    const variantId =
      selectedProduct?.id === productId
        ? selectedVariantId || selectedProduct?.variantId || product?.variantId || undefined
        : product?.variantId || undefined;
    const unitPriceRon = resolveUnitPriceRon(productId, variantId);

    setCart((prev) => {
      const found = prev.find(
        (line) => line.productId === productId && (line.variantId ?? '') === (variantId ?? ''),
      );
      if (!found) {
        return [
          ...prev,
          {
            productId,
            ...(variantId ? { variantId } : {}),
            quantity: 1,
            ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
          },
        ];
      }
      return prev.map((line) =>
        line.productId === productId && (line.variantId ?? '') === (variantId ?? '')
          ? {
              ...line,
              quantity: line.quantity + 1,
              ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
            }
          : line,
      );
    });

    if (accountUser) {
      const existingQty = cart.find(
        (line) => line.productId === productId && (line.variantId ?? '') === (variantId ?? ''),
      )?.quantity;
      void upsertCartLine({
        productId,
        ...(variantId ? { variantId } : {}),
        quantity: (existingQty ?? 0) + 1,
        ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
      }).catch(() => undefined);
    }

    void sendAnalyticsEvents([
      {
        name: 'add_to_cart',
        payload: { productId, variantId: variantId ?? null, page },
      },
    ]);
  };

  const changeQuantity = (productId: string, variantId: string | undefined, delta: number) => {
    const variantKey = variantId ?? '';

    setCart((prev) =>
      prev
        .map((line) =>
          line.productId === productId && (line.variantId ?? '') === variantKey
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );

    if (accountUser) {
      const current = cart.find(
        (line) => line.productId === productId && (line.variantId ?? '') === variantKey,
      );
      const nextQty = Math.max(0, (current?.quantity ?? 0) + delta);
      const unitPriceRon =
        typeof current?.unitPriceRon === 'number'
          ? current.unitPriceRon
          : resolveUnitPriceRon(productId, variantId);
      void upsertCartLine({
        productId,
        ...(variantId ? { variantId } : {}),
        quantity: nextQty,
        ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
      }).catch(() => undefined);
    }
  };

  const removeCartItem = (productId: string, variantId: string | undefined) => {
    const variantKey = variantId ?? '';
    const removedLine = cart.find(
      (line) => line.productId === productId && (line.variantId ?? '') === variantKey,
    );
    const removedProductName = productsById.get(productId)?.name ?? 'Produs';
    setCart((prev) =>
      prev.filter(
        (line) => !(line.productId === productId && (line.variantId ?? '') === variantKey),
      ),
    );
    if (removedLine) {
      setUndoRemoval({ line: removedLine, productName: removedProductName });
    }

    if (accountUser) {
      void removeCartLine(productId, variantId)
        .then((lines) => setCart(lines))
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Nu am putut elimina produsul din coÈ™.';
          setCatalogError(message);
          showToast(message, 'error');
        });
    }
  };

  const undoRemoveCartItem = () => {
    if (!undoRemoval) return;
    const { line } = undoRemoval;
    setUndoRemoval(null);

    setCart((prev) => {
      const found = prev.find(
        (item) =>
          item.productId === line.productId && (item.variantId ?? '') === (line.variantId ?? ''),
      );
      if (!found) return [...prev, line];
      return prev.map((item) =>
        item.productId === line.productId && (item.variantId ?? '') === (line.variantId ?? '')
          ? { ...item, quantity: item.quantity + line.quantity }
          : item,
      );
    });

    if (accountUser) {
      void upsertCartLine(line).catch(() => undefined);
    }

    showToast('Produs restaurat Ã®n coÈ™.');
  };

  const openCategory = (categoryId: string) => {
    persistPreferences((current) => ({
      ...current,
      continueBrowsingCategoryIds: [
        categoryId,
        ...current.continueBrowsingCategoryIds.filter((item) => item !== categoryId),
      ].slice(0, CONTINUE_BROWSING_LIMIT),
    }));
    setSelectedCategoryId(categoryId);
    setPage('products');
  };

  const restorePageWithScroll = (targetPage: Page, scrollY: number) => {
    const safeY = Math.max(0, Number.isFinite(scrollY) ? scrollY : 0);
    setPage(targetPage);
    pageScrollOffsetsRef.current[targetPage] = safeY;
    setTimeout(() => {
      restoringScrollRef.current = true;
      scrollRef.current?.scrollTo({ y: safeY, animated: false });
      setShowBackTop(safeY > 420);
      setTimeout(() => {
        restoringScrollRef.current = false;
      }, 80);
    }, 0);
  };

  const openProduct = (productId: string) => {
    const product = productsById.get(productId);
    trackContinueBrowsing(productId, product?.categoryId);
    productPageEntryRef.current = {
      page,
      scrollY: pageScrollOffsetsRef.current[page] ?? 0,
    };
    setSelectedProductId(productId);
    setPage('productDetails');
  };

  const goBackFromProductDetails = () => {
    const entry = productPageEntryRef.current;
    if (entry) {
      restorePageWithScroll(entry.page, entry.scrollY);
      return;
    }

    restorePageWithScroll('products', pageScrollOffsetsRef.current.products ?? 0);
  };

  const openImageZoom = (url: string | undefined) => {
    if (!hasImageUrl(url)) return;
    setZoomLevel(1);
    setZoomImageUrl(url);
  };

  const closeImageZoom = () => {
    setZoomImageUrl(null);
    setZoomLevel(1);
  };

  const resetFilters = () => {
    setBrandFilter('toate');
    setPriceFilter('toate');
    setOnlyDiscount(false);
    setOnlyInStock(true);
    setOnlyFavorites(false);
    setSortOption('relevanta');
    setFacetCategoryId('');
  };

  const cycleSortOption = () => {
    const sortOrder: SortOption[] = ['relevanta', 'pretCrescator', 'pretDescrescator', 'numeAZ'];
    const currentIndex = sortOrder.indexOf(sortOption);
    const next = sortOrder[(currentIndex + 1) % sortOrder.length] ?? 'relevanta';
    setSortOption(next);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchSuggestions([]);
    setFacetCategoryId('');
  };

  const setCategoryFacet = (categoryId: string) => {
    setFacetCategoryId((current) => (current === categoryId ? '' : categoryId));
    if (page !== 'products') {
      setPage('products');
    }
  };

  const toggleOnlyFavorites = () => {
    if (!accountUser && !onlyFavorites) {
      setCatalogError('AutentificÄƒ-te pentru a filtra doar produsele favorite.');
      goToLogin('products');
      return;
    }
    setOnlyFavorites((prev) => !prev);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length > 0 && page !== 'products') {
      setPage('products');
    }

    if (value.trim().length >= 2) {
      void fetchSearchSuggestions(value)
        .then((items) => setSearchSuggestions(items))
        .catch(() => setSearchSuggestions([]));
    } else {
      setSearchSuggestions([]);
    }
  };

  const handleSearchSubmit = (value: string) => {
    const query = value.trim();
    if (!query) {
      clearSearch();
      return;
    }

    setSearchQuery(query);
    setSearchHistory((prev) => [query, ...prev.filter((item) => item !== query)].slice(0, 8));

    const filterLabel = buildFilterSummaryLabel({
      brandFilter,
      priceFilter,
      onlyDiscount,
      onlyInStock,
      sortOption,
    });
    if (filterLabel.length > 0) {
      const snapshot: RecentFilterSnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: filterLabel,
        brandFilter,
        priceFilter,
        onlyDiscount,
        onlyInStock,
        sortOption,
        facetCategoryId,
      };
      setRecentFilterSnapshots((prev) =>
        [snapshot, ...prev.filter((item) => item.label !== snapshot.label)].slice(0, 8),
      );
    }

    if (page !== 'products') {
      setPage('products');
    }

    void fetchSearchSuggestions(query)
      .then((items) => setSearchSuggestions(items))
      .catch(() => setSearchSuggestions([]));
  };

  const saveSearchQuery = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setSavedSearches((prev) =>
      [normalized, ...prev.filter((item) => item !== normalized)].slice(0, 8),
    );
    showToast('CÄƒutare salvatÄƒ.');
  };

  const applyRecentFilterSnapshot = (snapshotId: string) => {
    const snapshot = recentFilterSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    setBrandFilter(snapshot.brandFilter);
    setPriceFilter(snapshot.priceFilter);
    setOnlyDiscount(snapshot.onlyDiscount);
    setOnlyInStock(snapshot.onlyInStock);
    setSortOption(snapshot.sortOption);
    setFacetCategoryId(snapshot.facetCategoryId);
    if (page !== 'products') {
      setPage('products');
    }
    showToast('Filtrele recente au fost aplicate.');
  };

  const handleAuthEmailChange = (value: string) => {
    setAuthEmail(value);
    if (authError) setAuthError(null);
  };

  const handleAuthPasswordChange = (value: string) => {
    setAuthPassword(value);
    if (authError) setAuthError(null);
  };

  const handleAuthNameChange = (value: string) => {
    setAuthName(value);
    if (authError) setAuthError(null);
  };

  const openDeviceSessions = () => {
    if (!accountUser) {
      showToast('AutentificÄƒ-te pentru a gestiona sesiunile dispozitivului.', 'error');
      return;
    }

    setShowSessionManager(true);
    void fetchDeviceSessions(deviceId)
      .then((sessions) => setDeviceSessions(sessions))
      .catch(() => undefined);
  };

  const removeDeviceSession = (sessionId: string) => {
    if (!accountUser) return;
    void revokeDeviceSession(sessionId)
      .then((sessions) => {
        setDeviceSessions(sessions);
        showToast('Sesiunea dispozitivului a fost revocatÄƒ.');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Nu am putut revoca sesiunea.';
        showToast(message, 'error');
      });
  };

  const trackContinueBrowsing = (productId: string, categoryId?: string) => {
    if (!productId) return;

    persistPreferences((current) => {
      const nextProducts = [
        productId,
        ...current.continueBrowsingProductIds.filter((item) => item !== productId),
      ].slice(0, CONTINUE_BROWSING_LIMIT);
      const nextCategories = categoryId
        ? [
            categoryId,
            ...current.continueBrowsingCategoryIds.filter((item) => item !== categoryId),
          ].slice(0, CONTINUE_BROWSING_LIMIT)
        : current.continueBrowsingCategoryIds;

      return {
        ...current,
        continueBrowsingProductIds: nextProducts,
        continueBrowsingCategoryIds: nextCategories,
      };
    });
  };

  const toggleCompareProduct = (productId: string) => {
    if (!productId || !productsById.has(productId)) return;

    persistPreferences((current) => {
      const exists = current.compareProductIds.includes(productId);
      if (exists) {
        return {
          ...current,
          compareProductIds: current.compareProductIds.filter((item) => item !== productId),
        };
      }

      return {
        ...current,
        compareProductIds: [...current.compareProductIds, productId].slice(-COMPARE_PRODUCTS_LIMIT),
      };
    });
  };

  const clearCompareProducts = () => {
    persistPreferences((current) => ({
      ...current,
      compareProductIds: [],
    }));
  };

  const handleBiometricPromptChoice = (enable: boolean) => {
    persistPreferences((current) => ({
      ...current,
      accountSettings: {
        ...current.accountSettings,
        biometricPromptShown: true,
        biometricLoginEnabled: enable ? true : current.accountSettings.biometricLoginEnabled,
      },
    }));
    setShowBiometricPrompt(false);
    showToast(
      enable
        ? 'Login biometric activat pe acest dispozitiv.'
        : 'PoÈ›i activa loginul biometric din SetÄƒri cont.',
    );
  };

  const toggleBiometricLoginSetting = () => {
    const nextEnabled = !accountSettings.biometricLoginEnabled;
    persistPreferences((current) => ({
      ...current,
      accountSettings: {
        ...current.accountSettings,
        biometricLoginEnabled: nextEnabled,
        biometricPromptShown: true,
      },
    }));
    showToast(nextEnabled ? 'Login biometric activat.' : 'Login biometric dezactivat.');
  };

  const mergeAccountSettings = (
    base: AccountSettings,
    patch: AccountSettingsPatch,
  ): AccountSettings => {
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
      profile: {
        ...base.profile,
        ...(patch.profile ?? {}),
      },
      notifications: {
        email: {
          ...base.notifications.email,
          ...(patch.notifications?.email ?? {}),
        },
        push: {
          ...base.notifications.push,
          ...(patch.notifications?.push ?? {}),
        },
        inApp: {
          ...base.notifications.inApp,
          ...(patch.notifications?.inApp ?? {}),
        },
      },
      privacy: {
        analyticsConsent: withConsentPatch(
          base.privacy.analyticsConsent,
          patch.privacy?.analyticsConsent,
        ),
        personalizationConsent: withConsentPatch(
          base.privacy.personalizationConsent,
          patch.privacy?.personalizationConsent,
        ),
        marketingConsent: withConsentPatch(
          base.privacy.marketingConsent,
          patch.privacy?.marketingConsent,
        ),
      },
      security: {
        ...base.security,
        ...(patch.security ?? {}),
      },
    };
  };

  const updateUnifiedAccountSettings = async (patch: AccountSettingsPatch) => {
    if (accountUser) {
      const nextSettings = await updateAccountSettings(patch);
      setServerAccountSettings(nextSettings);
      syncLocalPreferencesFromServerSettings(nextSettings);
      if (patch.profile?.displayName && patch.profile.displayName.trim().length > 0) {
        setAccountUser((current) =>
          current ? { ...current, name: patch.profile!.displayName!.trim() } : current,
        );
      }
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
      preferenceOnboarding: {
        ...current.preferenceOnboarding,
        marketingOptIn: merged.privacy.marketingConsent.granted,
      },
      accountSettings: {
        ...current.accountSettings,
        marketingEmailsEnabled: merged.privacy.marketingConsent.granted,
      },
    }));
  };

  const runChangePassword = async (currentPassword: string, newPassword: string) => {
    if (!accountUser) {
      throw new Error('Autentifica-te pentru schimbarea parolei.');
    }
    await changePassword({ currentPassword, newPassword });
  };

  const retryLoadProfileQr = () => {
    if (!accountUser) {
      setCatalogError('AutentificÄƒ-te pentru a genera codul QR de fidelitate.');
      goToLogin('loyalty');
      return;
    }

    setProfileQrError(null);
    setHasRequestedProfileQr(true);
    void generateLoyaltyQr()
      .then((payload) => {
        setLoyalty(payload.summary);
        setLoyaltyQrToken(payload.qrToken);
        setHasRequestedProfileQr(true);
        setCatalogMeta('Codul QR de fidelitate a fost regenerat.');
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Nu am putut genera codul QR de fidelitate.';
        setProfileQrError(message);
        setHasRequestedProfileQr(false);
        void fetchLoyaltySummary()
          .then((summary) => {
            setLoyalty(summary);
            setLoyaltyQrToken(summary.loyaltyQrToken ?? null);
            setVoucherQrToken(summary.lastVoucher?.qrToken ?? null);
          })
          .catch(() => undefined);
      });
  };

  const saveCurrentFiltersAsPreset = () => {
    const id = `preset-${Date.now()}`;
    const nextPreset = {
      id,
      name: `Preset ${filterPresets.length + 1}`,
      brandFilter,
      priceFilter,
      onlyDiscount,
      onlyInStock,
      sortOption,
    };

    persistPreferences((current) => ({
      ...current,
      filterPresets: [nextPreset, ...current.filterPresets].slice(0, 10),
    }));
    showToast('Presetul de filtre a fost salvat.');
  };

  const applyFilterPreset = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setBrandFilter(preset.brandFilter);
    setPriceFilter(preset.priceFilter);
    setOnlyDiscount(preset.onlyDiscount);
    setOnlyInStock(preset.onlyInStock);
    setSortOption(preset.sortOption);
    showToast(`Aplicat: ${preset.name}`);
  };

  const deleteFilterPreset = (presetId: string) => {
    persistPreferences((current) => ({
      ...current,
      filterPresets: current.filterPresets.filter((item) => item.id !== presetId),
    }));
  };

  const saveCurrentCartAsList = () => {
    if (cart.length === 0) {
      showToast('CoÈ™ul este gol. Nu existÄƒ nimic de salvat.', 'error');
      return;
    }

    const listId = `cart-list-${Date.now()}`;
    const snapshot = {
      id: listId,
      name: `Lista ${savedCartLists.length + 1}`,
      createdAt: new Date().toISOString(),
      lines: cart.map((item) => ({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        quantity: item.quantity,
        ...(typeof item.unitPriceRon === 'number' ? { unitPriceRon: item.unitPriceRon } : {}),
      })),
    };

    persistPreferences((current) => ({
      ...current,
      savedCartLists: [snapshot, ...current.savedCartLists].slice(0, 15),
    }));
    showToast('CoÈ™ul a fost salvat ca listÄƒ.');
  };

  const restoreCartList = (listId: string) => {
    const list = savedCartLists.find((item) => item.id === listId);
    if (!list) return;

    const previousCart = cart;
    setCart(list.lines);
    if (accountUser) {
      void replaceCartLines(list.lines)
        .then((lines) => {
          setCart(lines);
          showToast(`ListÄƒ restauratÄƒ: ${list.name}`);
        })
        .catch((error) => {
          setCart(previousCart);
          const message =
            error instanceof Error ? error.message : 'Nu am putut restaura lista Ã®n coÈ™.';
          showToast(message, 'error');
        });
      return;
    }
    showToast(`ListÄƒ restauratÄƒ: ${list.name}`);
  };

  const removeSavedCartList = (listId: string) => {
    persistPreferences((current) => ({
      ...current,
      savedCartLists: current.savedCartLists.filter((item) => item.id !== listId),
    }));
  };

  const toggleTrustConsent = (key: 'analytics' | 'personalization' | 'marketing') => {
    persistPreferences((current) => ({
      ...current,
      trustConsent: {
        ...current.trustConsent,
        [key]: !current.trustConsent[key],
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const toggleOnboardingBrand = (brand: string) => {
    persistPreferences((current) => {
      const set = new Set(current.preferenceOnboarding.favoriteBrands);
      if (set.has(brand)) set.delete(brand);
      else set.add(brand);

      return {
        ...current,
        preferenceOnboarding: {
          ...current.preferenceOnboarding,
          favoriteBrands: Array.from(set),
        },
      };
    });
  };

  const toggleOnboardingCategory = (categoryId: string) => {
    persistPreferences((current) => {
      const set = new Set(current.preferenceOnboarding.favoriteCategories);
      if (set.has(categoryId)) set.delete(categoryId);
      else set.add(categoryId);

      return {
        ...current,
        preferenceOnboarding: {
          ...current.preferenceOnboarding,
          favoriteCategories: Array.from(set),
        },
      };
    });
  };

  const completePreferenceOnboarding = () => {
    persistPreferences((current) => ({
      ...current,
      preferenceOnboarding: {
        ...current.preferenceOnboarding,
        completed: true,
      },
    }));
    showToast('PreferinÈ›ele tale au fost salvate.');
  };

  const goToLogin = (redirectPage: Page = page) => {
    setAuthError(null);
    if (!isStandaloneAuthPage(redirectPage)) {
      setAuthRedirectPage(redirectPage);
    }
    setPage('login');
  };

  const goToRegister = (redirectPage: Page = page) => {
    setAuthError(null);
    if (!isStandaloneAuthPage(redirectPage)) {
      setAuthRedirectPage(redirectPage);
    }
    setPage('register');
  };

  const handleOpenOrderDetails = (orderId: string) => {
    if (!accountUser) return;

    if (orderDetailsById[orderId]) {
      const cached = orderDetailsById[orderId];
      const addressLabel = cached?.address?.label ?? 'fÄƒrÄƒ adresÄƒ';
      showToast(`Detalii comandÄƒ: ${orderId} â€¢ ${addressLabel}`);
      return;
    }

    void fetchOrderDetails(orderId)
      .then((payload) => {
        setOrderDetailsById((prev) => ({
          ...prev,
          [orderId]: payload,
        }));
        const addressLabel = payload.address?.label ?? 'fÄƒrÄƒ adresÄƒ';
        showToast(`Detalii comandÄƒ Ã®ncÄƒrcate: ${addressLabel}`);
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Nu am putut Ã®ncÄƒrca detaliile comenzii.';
        setCatalogError(message);
        showToast(message, 'error');
      });
  };

  const renderAccountSection = () => {
    if (!accountUser) {
      return (
        <View style={styles.stackLarge}>
          <View style={styles.accountHeroCard}>
            <Text style={styles.sectionLabel}>Cont client</Text>
            <Text style={styles.bodyMuted}>
              AutentificÄƒ-te pentru comenzi, puncte, adrese È™i setÄƒri personalizate.
            </Text>
            <View style={styles.stackSmall}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => goToLogin()}>
                <Text style={styles.primaryButtonText}>IntrÄƒ Ã®n cont</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => goToRegister()}>
                <Text style={styles.secondaryButtonText}>CreeazÄƒ cont nou</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('settings')}>
                <Text style={styles.secondaryButtonText}>Setari locale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    const accountName = typeof accountUser.name === 'string' ? accountUser.name : '';
    const initials = accountName
      .split(' ')
      .map((item) => item.trim()[0])
      .filter((item): item is string => !!item)
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const recentOrders = orders.slice(0, 8);
    const wishlistPreview = products.filter((product) => wishlist.has(product.id)).slice(0, 6);
    const journeyChecklist = [
      {
        id: 'prefs',
        label: 'PreferinÈ›e personalizate configurate',
        done: preferenceOnboarding.completed,
      },
      { id: 'address', label: 'AdresÄƒ de livrare salvatÄƒ', done: addresses.length > 0 },
      { id: 'qr', label: 'Cod QR fidelitate activ', done: Boolean(loyaltyQrToken) },
      { id: 'order', label: 'Prima comandÄƒ plasatÄƒ', done: orders.length > 0 },
    ];
    const journeyPendingCount = journeyChecklist.filter((item) => !item.done).length;
    const segmentTabs: Array<{ id: AccountSegment; label: string; badge?: number }> = [
      {
        id: 'profile',
        label: 'Profil',
        ...(unreadInboxCount > 0 ? { badge: unreadInboxCount } : {}),
      },
      {
        id: 'orders',
        label: 'Comenzi',
        ...(pendingOrdersCount > 0 ? { badge: pendingOrdersCount } : {}),
      },
      { id: 'addresses', label: 'Adrese' },
      { id: 'privacy', label: 'ConfidenÈ›ialitate' },
      {
        id: 'journey',
        label: 'Ghid',
        ...(journeyPendingCount > 0 ? { badge: journeyPendingCount } : {}),
      },
    ];

    return (
      <View style={styles.stackLarge}>
        <View style={styles.accountHeroCard}>
          <View style={styles.accountHeroHead}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>{initials || 'DC'}</Text>
            </View>
            <View style={styles.accountHeroMetaWrap}>
              <Text style={styles.accountHeroName}>{accountName || 'Utilizator Dacus'}</Text>
              <Text style={styles.accountHeroEmail}>{accountUser.email || '-'}</Text>
            </View>
          </View>

          <View style={styles.accountStatsRow}>
            <View style={styles.accountStatCard}>
              <Text style={styles.accountStatLabel}>Puncte fidelitate</Text>
              <Text style={styles.accountStatValue}>{loyalty.points.toLocaleString('ro-RO')}</Text>
            </View>
            <View style={styles.accountStatCard}>
              <Text style={styles.accountStatLabel}>Dispozitive conectate</Text>
              <Text style={styles.accountStatValue}>{deviceSessions.length}</Text>
            </View>
            <View style={styles.accountStatCard}>
              <Text style={styles.accountStatLabel}>Comenzi</Text>
              <Text style={styles.accountStatValue}>{orders.length}</Text>
            </View>
          </View>

          <View style={styles.accountInlineActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('settings')}>
              <Text style={styles.secondaryButtonText}>Setari cont</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={openDeviceSessions}>
              <Text style={styles.secondaryButtonText}>Sesiuni active</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.accountQrPanel}>
            <Text style={styles.sectionLabel}>Codul tÄƒu de membru</Text>
            {loyaltyQrToken ? (
              <TouchableOpacity
                style={styles.qrTapWrap}
                activeOpacity={0.9}
                onPress={openLoyaltyQrPreview}
              >
                <QRCodeMatrix value={loyaltyQrToken} size={168} />
              </TouchableOpacity>
            ) : hasRequestedProfileQr ? (
              <Text style={styles.accountQrHint}>Se genereazÄƒ codul QR...</Text>
            ) : profileQrError ? (
              <View style={styles.stackSmall}>
                <Text style={styles.accountQrError}>{profileQrError}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={retryLoadProfileQr}>
                  <Text style={styles.secondaryButtonText}>ReÃ®ncearcÄƒ</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.secondaryButton} onPress={retryLoadProfileQr}>
                <Text style={styles.secondaryButtonText}>GenereazÄƒ codul QR</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountSegmentRow}
        >
          {segmentTabs.map((segment) => (
            <TouchableOpacity
              key={segment.id}
              style={[
                styles.accountSegmentPill,
                accountSegment === segment.id && styles.accountSegmentPillActive,
              ]}
              onPress={() => setAccountSegment(segment.id)}
            >
              <Text
                style={[
                  styles.accountSegmentText,
                  accountSegment === segment.id && styles.accountSegmentTextActive,
                ]}
              >
                {segment.label}
              </Text>
              {segment.badge ? (
                <View
                  style={[
                    styles.accountSegmentBadge,
                    accountSegment === segment.id && styles.accountSegmentBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.accountSegmentBadgeText,
                      accountSegment === segment.id && styles.accountSegmentBadgeTextActive,
                    ]}
                  >
                    {segment.badge}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {accountSegment === 'profile' ? (
          <>
            <View style={styles.cardPlain}>
              <Text style={styles.sectionLabel}>Wishlist</Text>
              <Text style={styles.bodyMuted}>{wishlist.size} produse favorite</Text>
              {wishlistPreview.length === 0 ? (
                <Text style={styles.bodyMuted}>Nu ai produse favorite salvate.</Text>
              ) : (
                wishlistPreview.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.accountListRow}
                    onPress={() => toggleWishlist(product.id)}
                  >
                    <Text style={styles.bodyText}>
                      {wishlist.has(product.id) ? 'â˜…' : 'â˜†'} {product.name}
                    </Text>
                    <Text style={styles.accountListMeta}>
                      {product.brand} â€¢ {formatPrice(product.priceRon)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.cardPlain}>
              <Text style={styles.sectionLabel}>Inbox notificÄƒri</Text>
              {inbox.length === 0 ? (
                <Text style={styles.bodyMuted}>Nu ai notificÄƒri.</Text>
              ) : (
                inbox.slice(0, 6).map((note) => (
                  <TouchableOpacity
                    key={note.id}
                    style={styles.accountListRow}
                    onPress={() => {
                      void markInboxNotificationRead(note.id)
                        .then(() => fetchInbox())
                        .then((items) => setInbox(items))
                        .catch(() => undefined);
                    }}
                  >
                    <Text style={styles.bodyText}>{note.title}</Text>
                    <Text style={styles.bodyMuted}>{note.message}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        ) : null}

        {accountSegment === 'orders' ? (
          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Comenzi recente</Text>
            {recentOrders.length === 0 ? (
              <Text style={styles.bodyMuted}>Nu ai comenzi Ã®ncÄƒ.</Text>
            ) : (
              recentOrders.map((order) => {
                const detail = orderDetailsById[order.id];
                const trackingCode =
                  typeof order.trackingCode === 'string' && order.trackingCode.length > 0
                    ? order.trackingCode
                    : null;
                const detailAddressLabel = detail && detail.address ? detail.address.label : null;
                const timeline =
                  order.status === 'created'
                    ? ['ComandÄƒ plasatÄƒ']
                    : order.status === 'processing'
                      ? ['ComandÄƒ plasatÄƒ', 'ÃŽn procesare']
                      : ['ComandÄƒ plasatÄƒ', 'ÃŽn procesare', 'ExpediatÄƒ'];

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.accountListRow}
                    onPress={() => handleOpenOrderDetails(order.id)}
                  >
                    <Text style={styles.bodyText}>{order.id}</Text>
                    <Text style={styles.accountListMeta}>
                      {orderStatusLabels[order.status]} Â· {formatPrice(order.totalRon)}
                    </Text>
                    {trackingCode && (
                      <Text style={styles.accountListMeta}>{`Tracking: ${trackingCode}`}</Text>
                    )}
                    {detailAddressLabel && (
                      <Text style={styles.accountListMeta}>{`AdresÄƒ: ${detailAddressLabel}`}</Text>
                    )}
                    <View style={styles.orderTimelineRow}>
                      {timeline.map((step, index) => (
                        <View key={`${order.id}-${step}`} style={styles.orderTimelineStep}>
                          <Text style={styles.orderTimelineDot}>
                            {index === timeline.length - 1 ? 'â—' : 'â—‹'}
                          </Text>
                          <Text style={styles.orderTimelineText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}

        {accountSegment === 'addresses' ? (
          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Adrese livrare</Text>
            {addresses.length === 0 ? (
              <Text style={styles.bodyMuted}>Nu ai adrese salvate.</Text>
            ) : (
              addresses.map((address) => {
                const active = address.id === selectedAddressId;
                return (
                  <View key={address.id} style={styles.accountListRow}>
                    <Text style={styles.bodyText}>
                      {active ? 'â˜… ' : 'â—‹ '}
                      {address.label}
                    </Text>
                    <Text style={styles.accountListMeta}>
                      {address.fullName} Â· {address.phone}
                    </Text>
                    <Text style={styles.accountListMeta}>
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.county},{' '}
                      {address.postalCode}, {address.countryCode}
                    </Text>
                    <View style={styles.accountInlineActions}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => handleSelectAddress(address.id)}
                        disabled={addressBusy || active}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {active ? 'ImplicitÄƒ' : 'SeteazÄƒ implicitÄƒ'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => openEditAddressEditor(address)}
                        disabled={addressBusy}
                      >
                        <Text style={styles.secondaryButtonText}>EditeazÄƒ</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => handleDeleteAddress(address.id)}
                        disabled={addressBusy}
                      >
                        <Text style={styles.secondaryButtonText}>È˜terge</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openCreateAddressEditor}
              disabled={addressBusy}
            >
              <Text style={styles.primaryButtonText}>
                {addressBusy ? 'Se actualizeazÄƒ...' : 'AdaugÄƒ adresÄƒ'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {accountSegment === 'privacy' ? (
          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>SetÄƒri cont È™i confidenÈ›ialitate</Text>
            <Text style={styles.bodyMuted}>
              Controalele complete au fost mutate in ecranul dedicat de Setari pentru a evita
              conflictele intre preferintele locale si cele sincronizate server-side.
            </Text>
            <View style={styles.accountInlineActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('settings')}>
                <Text style={styles.secondaryButtonText}>Deschide Setari</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {accountSegment === 'journey' ? (
          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Ghid de onboarding</Text>
            <Text style={styles.bodyMuted}>
              FinalizeazÄƒ paÈ™ii de mai jos pentru o experienÈ›Äƒ completÄƒ È™i personalizatÄƒ.
            </Text>

            <View style={styles.journeyChecklist}>
              {journeyChecklist.map((item) => (
                <View
                  key={item.id}
                  style={[styles.journeyItem, item.done && styles.journeyItemDone]}
                >
                  <Text style={styles.journeyItemIcon}>{item.done ? 'âœ“' : 'â—‹'}</Text>
                  <View style={styles.journeyItemMeta}>
                    <Text style={styles.bodyText}>{item.label}</Text>
                    <Text style={styles.bodyMuted}>
                      {item.done ? 'Completat' : 'ÃŽn aÈ™teptare'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.journeyActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('products')}>
                <Text style={styles.secondaryButtonText}>ExploreazÄƒ produse</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('loyalty')}>
                <Text style={styles.secondaryButtonText}>Vezi fidelitatea</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setAccountSegment('addresses')}
              >
                <Text style={styles.secondaryButtonText}>ConfigureazÄƒ adrese</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('settings')}>
                <Text style={styles.secondaryButtonText}>SetÄƒri confidenÈ›ialitate</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const handleCheckout = () => {
    if (!accountUser) {
      setCatalogError('AutentificÄƒ-te Ã®nainte de checkout.');
      goToLogin();
      return;
    }

    if (!selectedAddressId) {
      setCatalogError('SelecteazÄƒ sau adaugÄƒ o adresÄƒ de livrare Ã®nainte de checkout.');
      showToast('AdaugÄƒ adresa de livrare Ã®nainte de finalizarea comenzii.', 'error');
      return;
    }

    setCheckoutBusy(true);

    void validateCart()
      .then((validation) => {
        if (!validation.ok) {
          const firstIssue = validation.issues[0];
          throw new Error(
            firstIssue?.messageRo ??
              firstIssue?.message ??
              'CoÈ™ul trebuie actualizat Ã®nainte de checkout.',
          );
        }

        setCart(validation.lines);
        return checkoutCart({ addressId: selectedAddressId });
      })
      .then((payload) => {
        setCatalogMeta(`Checkout iniÈ›iat: ${payload.orderId}`);
        showToast(`ComandÄƒ plasatÄƒ: ${formatPrice(payload.totalRon)}`);
        return Promise.all([
          fetchOrders(),
          fetchCart(),
          fetchOrderDetails(payload.orderId),
          Linking.openURL(payload.checkoutUrl).catch(() => undefined),
        ]);
      })
      .then(([nextOrders, nextCart, orderDetails]) => {
        setOrders(nextOrders);
        setCart(nextCart);
        setOrderDetailsById((prev) => ({
          ...prev,
          [orderDetails.order.id]: orderDetails,
        }));
        setPage('account');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Checkout indisponibil momentan.';
        setCatalogError(message);
        showToast(message, 'error');
      })
      .finally(() => setCheckoutBusy(false));
  };

  const addBundleToCart = (productIds: string[]) => {
    const uniqueIds = Array.from(
      new Set(productIds.filter((id) => typeof id === 'string' && id.length > 0)),
    ).slice(0, 5);
    uniqueIds.forEach((id) => addToCart(id));
    if (uniqueIds.length > 0) {
      showToast(`Bundle adÄƒugat Ã®n coÈ™ (${uniqueIds.length} produse).`);
    }
  };

  const toggleBackInStockAlert = (productId: string) => {
    if (!accountUser) {
      showToast('AutentificÄƒ-te pentru alerte de stoc.', 'error');
      goToLogin('productDetails');
      return;
    }

    const previous = new Set(backInStockSubscriptions);
    const currentlyActive = backInStockSubscriptions.has(productId);
    const next = new Set(backInStockSubscriptions);
    if (currentlyActive) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setBackInStockSubscriptions(next);

    void setBackInStockSubscription(productId, !currentlyActive)
      .then((ids) => setBackInStockSubscriptions(new Set(ids)))
      .then(() => {
        showToast(
          currentlyActive
            ? 'Alerta de stoc a fost dezactivatÄƒ.'
            : 'Te anunÈ›Äƒm cÃ¢nd revine Ã®n stoc.',
        );
      })
      .catch((error) => {
        setBackInStockSubscriptions(previous);
        const message =
          error instanceof Error ? error.message : 'Nu am putut actualiza alerta de stoc.';
        showToast(message, 'error');
      });
  };

  const openCreateAddressEditor = () => {
    if (!accountUser || addressBusy) return;
    setAddressEditorId(null);
    setAddressDraft(buildInitialAddressDraft(accountUser.name));
    setAddressFormError(null);
    setAddressEditorVisible(true);
  };

  const openEditAddressEditor = (address: Address) => {
    if (!accountUser || addressBusy) return;
    setAddressEditorId(address.id);
    setAddressDraft({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      county: address.county,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
    });
    setAddressFormError(null);
    setAddressEditorVisible(true);
  };

  const closeAddressEditor = () => {
    if (addressBusy) return;
    setAddressEditorVisible(false);
    setAddressEditorId(null);
    setAddressFormError(null);
  };

  const updateAddressDraftValue = (key: keyof AddressDraft, value: string) => {
    const normalizedValue =
      key === 'phone'
        ? formatPhoneInput(value)
        : key === 'postalCode'
          ? formatPostalCodeInput(value)
          : value;
    setAddressDraft((current) => ({
      ...current,
      [key]: normalizedValue,
    }));
    if (addressFormError) setAddressFormError(null);
  };

  const submitAddressEditor = () => {
    if (!accountUser || addressBusy) return;

    const normalizedLine2 = addressDraft.line2?.trim() ?? '';
    const nextDraft: AddressDraft = {
      label: addressDraft.label.trim(),
      fullName: addressDraft.fullName.trim(),
      phone: addressDraft.phone.trim(),
      line1: addressDraft.line1.trim(),
      city: addressDraft.city.trim(),
      county: addressDraft.county.trim(),
      postalCode: addressDraft.postalCode.trim(),
      countryCode: (addressDraft.countryCode.trim() || 'RO').toUpperCase(),
      ...(normalizedLine2.length > 0 ? { line2: normalizedLine2 } : {}),
    };

    if (
      [
        nextDraft.label,
        nextDraft.fullName,
        nextDraft.phone,
        nextDraft.line1,
        nextDraft.city,
        nextDraft.county,
        nextDraft.postalCode,
        nextDraft.countryCode,
      ].some((value) => value.length === 0)
    ) {
      setAddressFormError('CompleteazÄƒ toate cÃ¢mpurile obligatorii.');
      return;
    }

    if (nextDraft.phone.replace(/\D/g, '').length < 9) {
      setAddressFormError('NumÄƒrul de telefon este invalid.');
      return;
    }

    const editingAddressId = addressEditorId;
    setAddressBusy(true);
    setAddressFormError(null);

    const request = editingAddressId
      ? updateAddress(editingAddressId, nextDraft)
      : createAddress(nextDraft);

    void request
      .then((payload) => {
        setAddresses(payload.addresses);
        setSelectedAddressId(payload.selectedAddressId);
        setAddressEditorVisible(false);
        setAddressEditorId(null);
        showToast(
          editingAddressId ? 'Adresa a fost actualizatÄƒ.' : 'AdresÄƒ de livrare adÄƒugatÄƒ.',
        );
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Nu am putut salva adresa.';
        setAddressFormError(message);
        setCatalogError(message);
        showToast(message, 'error');
      })
      .finally(() => setAddressBusy(false));
  };

  const handleSelectAddress = (addressId: string) => {
    if (!accountUser || addressBusy) return;
    const previousAddressId = selectedAddressId;
    setSelectedAddressId(addressId);
    setAddressBusy(true);
    void selectAddress(addressId)
      .then(() => {
        showToast('Adresa de livrare a fost actualizatÄƒ.');
      })
      .catch((error) => {
        setSelectedAddressId(previousAddressId);
        const message = error instanceof Error ? error.message : 'Nu am putut selecta adresa.';
        setCatalogError(message);
        showToast(message, 'error');
      })
      .finally(() => setAddressBusy(false));
  };

  const handleDeleteAddress = (addressId: string) => {
    if (!accountUser || addressBusy) return;
    setAddressBusy(true);
    void deleteAddress(addressId)
      .then((payload) => {
        setAddresses(payload.addresses);
        setSelectedAddressId(payload.selectedAddressId);
        showToast('AdresÄƒ eliminatÄƒ.');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Nu am putut È™terge adresa.';
        setCatalogError(message);
        showToast(message, 'error');
      })
      .finally(() => setAddressBusy(false));
  };

  const handleRedeemVoucher = () => {
    if (!accountUser) {
      setCatalogError('AutentificÄƒ-te pentru a genera voucherul de fidelitate.');
      goToLogin('loyalty');
      return;
    }

    if (loyalty.points < loyaltyRedeemPoints) {
      setCatalogError('Nu ai suficiente puncte pentru valoarea selectatÄƒ.');
      return;
    }

    setLoyaltyBusy(true);
    void redeemLoyaltyVoucher(loyaltyRedeemPoints)
      .then((payload) => {
        setLoyalty(payload.summary);
        setVoucherQrToken(payload.voucher.qrToken ?? null);
        setCatalogMeta(`Voucher generat: ${payload.voucher.code}`);
        showToast('Voucherul a fost generat È™i are QR dedicat pentru scanare Ã®n magazin.');
        return fetchInbox();
      })
      .then((items) => setInbox(items))
      .catch((error) =>
        setCatalogError(error instanceof Error ? error.message : 'Voucher indisponibil momentan.'),
      )
      .finally(() => setLoyaltyBusy(false));
  };

  const handleRefreshLoyalty = () => {
    if (!accountUser) {
      setCatalogError('AutentificÄƒ-te pentru a actualiza datele de fidelitate.');
      goToLogin('loyalty');
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
        setCatalogMeta('Datele de fidelitate au fost actualizate.');
      })
      .catch((error) =>
        setCatalogError(
          error instanceof Error ? error.message : 'Actualizarea fidelitÄƒÈ›ii a eÈ™uat momentan.',
        ),
      )
      .finally(() => setLoyaltyRefreshing(false));
  };

  const handleShareVoucher = () => {
    if (!loyalty.lastVoucher?.code || !voucherQrToken) {
      setCatalogError('Nu existÄƒ voucher activ cu QR pentru partajare.');
      return;
    }

    void Share.share({
      message: `Voucher Dacus: ${loyalty.lastVoucher.code} â€¢ ${formatPrice(loyalty.lastVoucher.valueRon)} â€¢ Cod scanare: ${voucherQrToken}`,
    }).catch(() => setCatalogError('Partajarea voucherului nu a reuÈ™it momentan.'));
  };

  const openVoucherQrPreview = () => {
    if (!voucherQrToken) {
      setCatalogError('Nu existÄƒ QR de voucher activ.');
      return;
    }
    setQrModalToken(voucherQrToken);
  };

  const openLoyaltyQrPreview = () => {
    if (!loyaltyQrToken) {
      setCatalogError('Nu existÄƒ QR de fidelitate activ.');
      return;
    }
    setQrModalToken(loyaltyQrToken);
  };

  const handleShareQrToken = () => {
    if (!loyaltyQrToken) {
      setCatalogError('Nu existÄƒ cod de membru activ pentru partajare.');
      return;
    }

    void Share.share({
      message: `Cod de membru fidelitate Dacus: ${loyaltyQrToken}`,
    }).catch(() => setCatalogError('Partajarea codului de membru nu a reuÈ™it momentan.'));
  };

  const toggleWishlist = (productId: string) => {
    const previous = new Set(wishlist);
    const active = wishlist.has(productId);
    const next = new Set(wishlist);
    if (active) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setWishlist(next);

    if (accountUser) {
      void setWishlistProduct(productId, !active)
        .then((ids) => setWishlist(new Set(ids)))
        .catch((error) => {
          setWishlist(previous);
          const message =
            error instanceof Error ? error.message : 'Nu am putut actualiza favoritele.';
          showToast(message, 'error');
        });
    }
  };

  const runLogin = () => {
    const email = authEmail.trim();
    if (!email || !authPassword.trim()) {
      setAuthError('CompleteazÄƒ email È™i parolÄƒ.');
      return;
    }

    if (!email.includes('@')) {
      setAuthError('Email invalid.');
      return;
    }

    setAuthError(null);
    setAuthBusy(true);

    void loginAccount(email, authPassword)
      .then((user) => {
        setAccountUser(user);
        setCatalogError(null);
        setCatalogMeta(`Bine ai revenit, ${user.name}.`);
        return Promise.all([
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
      })
      .then(
        ([
          cartLines,
          orderItems,
          wishlistIds,
          inboxItems,
          loyaltySummary,
          addressPayload,
          subscribedIds,
          sessions,
          settingsPayload,
        ]) => {
          setCart(cartLines);
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
          if (settingsPayload) {
            setServerAccountSettings(settingsPayload);
            syncLocalPreferencesFromServerSettings(settingsPayload);
          }
          setAuthPassword('');
          setPage(
            authRedirectPage && !isStandaloneAuthPage(authRedirectPage)
              ? authRedirectPage
              : 'account',
          );
          setAuthRedirectPage(null);
          setShouldPromptBiometricAfterAuth(true);
          showToast('Autentificare reuÈ™itÄƒ. Bine ai revenit!');
          void registerDeviceForNotifications(`ios-${Date.now()}`, 'ios').catch(() => undefined);
        },
      )
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Autentificare eÈ™uatÄƒ. VerificÄƒ datele È™i Ã®ncearcÄƒ din nou.';
        setAuthError(message);
        showToast(message, 'error');
      })
      .finally(() => setAuthBusy(false));
  };

  const runPasswordReset = () => {
    const email = authEmail.trim();
    if (!email || !email.includes('@')) {
      setAuthError('Introdu un email valid pentru resetarea parolei.');
      return;
    }

    setAuthError(null);
    setAuthBusy(true);
    void requestPasswordReset(email)
      .then(() => {
        setCatalogMeta('Reset password trimis (demo).');
        showToast('Emailul de resetare a fost trimis.');
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Nu s-a putut trimite emailul de resetare momentan.';
        setAuthError(message);
        showToast(message, 'error');
      })
      .finally(() => setAuthBusy(false));
  };

  const runRegister = () => {
    if (registerStep === 1) {
      setRegisterStep(2);
      return;
    }

    const email = authEmail.trim();
    const name = authName.trim();

    if (!email || !authPassword.trim() || !name) {
      setAuthError('CompleteazÄƒ toate cÃ¢mpurile pentru Ã®nregistrare.');
      return;
    }

    if (!email.includes('@')) {
      setAuthError('Email invalid.');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Parola trebuie sÄƒ aibÄƒ minimum 6 caractere.');
      return;
    }

    setAuthError(null);
    setAuthBusy(true);
    void registerAccount(email, authPassword, name)
      .then((user) => {
        setAccountUser(user);
        setCatalogError(null);
        setCatalogMeta(`Cont creat pentru ${user.name}`);
        return Promise.all([
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
      })
      .then(
        ([
          cartLines,
          orderItems,
          wishlistIds,
          inboxItems,
          loyaltySummary,
          addressPayload,
          subscribedIds,
          sessions,
          settingsPayload,
        ]) => {
          setCart(cartLines);
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
          if (settingsPayload) {
            setServerAccountSettings(settingsPayload);
            syncLocalPreferencesFromServerSettings(settingsPayload);
          }
          setAuthPassword('');
          completePreferenceOnboarding();
          setPage(
            authRedirectPage && !isStandaloneAuthPage(authRedirectPage)
              ? authRedirectPage
              : 'account',
          );
          setAuthRedirectPage(null);
          setShouldPromptBiometricAfterAuth(true);
          showToast('Cont creat cu succes. Bine ai venit!');
          void registerDeviceForNotifications(`ios-${Date.now()}`, 'ios').catch(() => undefined);
        },
      )
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'ÃŽnregistrare eÈ™uatÄƒ. VerificÄƒ datele È™i Ã®ncearcÄƒ din nou.';
        setAuthError(message);
        showToast(message, 'error');
      })
      .finally(() => setAuthBusy(false));
  };

  const runLogout = () => {
    setAuthBusy(true);
    void logoutAccount()
      .then(() => {
        setAccountUser(null);
        setAuthError(null);
        setAuthPassword('');
        setAuthName('');
        setAuthEmail('');
        setCart([]);
        setOrders([]);
        setWishlist(new Set());
        setInbox([]);
        setOrderDetailsById({});
        setAddresses([]);
        setSelectedAddressId(null);
        setBackInStockSubscriptions(new Set());
        setDeviceSessions([]);
        setShowSessionManager(false);
        setLoyalty(defaultLoyalty);
        setLoyaltyQrToken(null);
        setVoucherQrToken(null);
        setServerAccountSettings(null);
        setHasRequestedProfileQr(false);
        setProfileQrError(null);
        setShowBiometricPrompt(false);
        setShouldPromptBiometricAfterAuth(false);
        setPage('home');
      })
      .finally(() => setAuthBusy(false));
  };

  const productList = () => {
    const visibleProducts = filteredProducts;

    const mapPriceFilter = (value: PriceFilterOption): { min?: number; max?: number } => {
      if (value === 'sub200') return { max: 199 };
      if (value === 'intre200si500') return { min: 200, max: 500 };
      if (value === 'intre500si1000') return { min: 501, max: 1000 };
      if (value === 'peste1000') return { min: 1001 };
      return {};
    };

    const loadMoreProducts = () => {
      if (productsLoadingMore || !productsHasMoreForView) return;
      const nextPage = productsPage + 1;
      setProductsLoadingMore(true);
      const requestPerPage =
        searchQuery.trim().length > 0 ? PRODUCTS_PAGE_SIZE * 2 : PRODUCTS_PAGE_SIZE;
      const effectiveCategoryId =
        searchQuery.trim().length === 0 ? selectedCategoryId : facetCategoryId || undefined;

      const priceRange = mapPriceFilter(priceFilter);

      void fetchProductSearch({
        query: searchQuery,
        page: nextPage,
        perPage: requestPerPage,
        sortBy: sortOption,
        ...(effectiveCategoryId ? { categoryId: effectiveCategoryId } : {}),
        ...(brandFilter !== 'toate' ? { vendor: brandFilter } : {}),
        onlyInStock,
        onlyDiscount,
        ...(typeof priceRange.min === 'number' ? { priceMin: priceRange.min } : {}),
        ...(typeof priceRange.max === 'number' ? { priceMax: priceRange.max } : {}),
        includeFacets: true,
      })
        .then((payload) => {
          setProductsPage(payload.page);
          setProductsTotal(payload.total);
          setProductsHasMore(payload.hasMore);
          setSearchResults((current) => {
            const merged = new Map(current.map((item) => [item.id, item]));
            payload.products.forEach((item) => merged.set(item.id, item));
            return Array.from(merged.values());
          });
          setSearchFacets((current) => (payload.facets.length > 0 ? payload.facets : current));
          setSearchVendors((current) => {
            const extracted = extractVendorsFromFacets(payload.facets);
            return extracted.length > 0 ? extracted : current;
          });
          upsertProducts(payload.products);
        })
        .catch((error) => {
          setCatalogError(
            error instanceof Error ? error.message : 'Nu s-au putut Ã®ncÄƒrca mai multe produse.',
          );
        })
        .finally(() => setProductsLoadingMore(false));
    };

    if (isLoading) {
      return (
        <View style={styles.stackLarge}>
          <Skeleton height={18} width="44%" />
          <View style={styles.gridWrap}>
            <Skeleton height={248} width="48%" />
            <Skeleton height={248} width="48%" />
            <Skeleton height={248} width="48%" />
            <Skeleton height={248} width="48%" />
          </View>
        </View>
      );
    }

    if (filteredProducts.length === 0) {
      return (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>Nu existÄƒ produse pentru filtrarea curentÄƒ</Text>
          <Text style={styles.emptyText}>
            ÃŽncearcÄƒ sÄƒ resetezi filtrele sau sÄƒ alegi o categorie diferitÄƒ.
          </Text>
          <View style={styles.emptyStateActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetFilters}>
              <Text style={styles.secondaryButtonText}>ReseteazÄƒ filtrele</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={false}
        contentContainerStyle={styles.gridListContent}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <View style={styles.gridCell}>
            <ProductCard
              product={item}
              onOpen={openProduct}
              onAdd={addToCart}
              compareMode={compareMode}
              compareSelected={compareProductIdSet.has(item.id)}
              compareDisabled={
                compareMode &&
                !compareProductIdSet.has(item.id) &&
                compareProductIds.length >= COMPARE_PRODUCTS_LIMIT
              }
              onToggleCompare={toggleCompareProduct}
            />
          </View>
        )}
        onEndReachedThreshold={0.55}
        onEndReached={() => {
          loadMoreProducts();
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={9}
        removeClippedSubviews
        ListFooterComponent={
          productsHasMoreForView ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreProducts}>
              <Text style={styles.loadMoreButtonText}>
                {productsLoadingMore ? 'Se Ã®ncarcÄƒ...' : 'AfiÈ™eazÄƒ mai multe produse'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  };

  const onScrollMain = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const nextY = event.nativeEvent.contentOffset.y;
    pageScrollOffsetsRef.current[page] = nextY;
    if (!restoringScrollRef.current) {
      setShowBackTop(nextY > 420);
    }
  };

  const backToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const renderPage = () => {
    if (page === 'login') {
      return (
        <LoginScreen
          email={authEmail}
          password={authPassword}
          busy={authBusy}
          errorMessage={authError}
          sessionsCount={deviceSessions.length}
          onEmailChange={handleAuthEmailChange}
          onPasswordChange={handleAuthPasswordChange}
          onLogin={runLogin}
          onOpenSessions={openDeviceSessions}
          onResetPassword={runPasswordReset}
          onGoRegister={goToRegister}
        />
      );
    }

    if (page === 'register') {
      return (
        <RegisterScreen
          email={authEmail}
          password={authPassword}
          name={authName}
          step={registerStep}
          preferenceBrands={availableBrands.slice(0, 10)}
          selectedBrands={preferenceOnboarding.favoriteBrands}
          preferenceCategories={categories.map((category) => ({
            id: category.id,
            name: category.name,
          }))}
          selectedCategoryIds={preferenceOnboarding.favoriteCategories}
          marketingOptIn={preferenceOnboarding.marketingOptIn}
          consentAnalytics={trustConsent.analytics}
          consentPersonalization={trustConsent.personalization}
          consentMarketing={trustConsent.marketing}
          busy={authBusy}
          errorMessage={authError}
          onEmailChange={handleAuthEmailChange}
          onPasswordChange={handleAuthPasswordChange}
          onNameChange={handleAuthNameChange}
          onNextStep={() => setRegisterStep(2)}
          onBackStep={() => setRegisterStep(1)}
          onToggleBrand={toggleOnboardingBrand}
          onToggleCategory={toggleOnboardingCategory}
          onToggleMarketingOptIn={() =>
            persistPreferences((current) => ({
              ...current,
              preferenceOnboarding: {
                ...current.preferenceOnboarding,
                marketingOptIn: !current.preferenceOnboarding.marketingOptIn,
              },
            }))
          }
          onToggleConsent={toggleTrustConsent}
          onRegister={runRegister}
          onGoLogin={goToLogin}
        />
      );
    }

    if (page === 'categories') {
      return (
        <CategoriesScreen
          styles={styles}
          isLoading={isLoading}
          categories={orderedCategoriesForView.map((item) => item.category)}
          countByCategory={countByCategory}
          onOpenCategory={openCategory}
          hasImageUrl={hasImageUrl}
        />
      );
    }

    if (page === 'products') {
      return (
        <ProductsScreen
          styles={styles}
          selectedCategoryName={selectedCategory?.name ?? 'Produse'}
          searchQuery={searchQuery}
          productsTotalForView={productsTotalForView}
          filteredProductsCount={filteredProducts.length}
          sortLabel={sortLabelMap[sortOption]}
          sortOption={sortOption}
          onlyFavorites={onlyFavorites}
          filterCount={filterCount}
          brandFilter={brandFilter}
          availableBrands={availableBrands}
          priceFilter={priceFilter}
          onlyDiscount={onlyDiscount}
          onlyInStock={onlyInStock}
          brandFacetCounts={brandFacetCounts}
          categoryFacetOptions={categoryFacetOptions}
          availabilityFacetCounts={availabilityFacetCounts}
          facetConfidenceHints={facetConfidenceHints}
          onCycleSort={cycleSortOption}
          onToggleFavorites={toggleOnlyFavorites}
          onOpenCategories={() => setPage('categories')}
          onResetFilters={resetFilters}
          onSetBrandFilter={setBrandFilter}
          onSetPriceFilter={setPriceFilter}
          onToggleOnlyDiscount={() => setOnlyDiscount((prev) => !prev)}
          onSetOnlyInStock={setOnlyInStock}
          onToggleOnlyInStock={() => setOnlyInStock((prev) => !prev)}
          onSetCategoryFacet={setCategoryFacet}
          onSetSortOption={setSortOption}
          onClearSearch={clearSearch}
          productListNode={
            <View style={styles.stackSmall}>
              <View style={styles.compareToolbar}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={saveCurrentFiltersAsPreset}
                >
                  <Text style={styles.secondaryButtonText}>SalveazÄƒ preset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setCompareMode((prev) => !prev)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {compareMode ? 'IeÈ™i din comparare' : 'Compare mode'}
                  </Text>
                </TouchableOpacity>
              </View>

              {filterPresets.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipRow}
                >
                  {filterPresets.map((preset) => (
                    <View key={preset.id} style={styles.filterPresetWrap}>
                      <TouchableOpacity
                        style={styles.filterPill}
                        onPress={() => applyFilterPreset(preset.id)}
                      >
                        <Text style={styles.filterPillText}>{preset.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.filterPresetDelete}
                        onPress={() => deleteFilterPreset(preset.id)}
                      >
                        <Text style={styles.filterPresetDeleteText}>Ã—</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              {compareMode ? (
                <View style={styles.comparePanel}>
                  <View style={styles.comparePanelHead}>
                    <View style={styles.comparePanelTitleWrap}>
                      <Text style={styles.comparePanelTitle}>Compare mode activ</Text>
                      <Text style={styles.comparePanelMeta}>
                        {compareProducts.length}/{COMPARE_PRODUCTS_LIMIT} produse selectate
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.compareClearButton,
                        compareProducts.length === 0 && styles.compareClearButtonDisabled,
                      ]}
                      onPress={clearCompareProducts}
                      disabled={compareProducts.length === 0}
                    >
                      <Text style={styles.compareClearButtonText}>GoleÈ™te</Text>
                    </TouchableOpacity>
                  </View>

                  {compareProducts.length === 0 ? (
                    <Text style={styles.bodyMuted}>
                      SelecteazÄƒ produse din lista de mai jos pentru comparaÈ›ie.
                    </Text>
                  ) : (
                    compareProducts.map((product) => (
                      <View key={product.id} style={styles.compareRow}>
                        <View style={styles.compareInfo}>
                          <Text style={styles.bodyText}>{product.name}</Text>
                          <Text style={styles.bodyMuted}>
                            {product.brand} â€¢ {formatPrice(product.priceRon)} â€¢{' '}
                            {product.stockLabel}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => toggleCompareProduct(product.id)}
                        >
                          <Text style={styles.secondaryButtonText}>EliminÄƒ</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                  <Text style={styles.bodyMuted}>
                    Pentru selecÈ›ie rapidÄƒ foloseÈ™te badge-ul â€žComparÄƒâ€ din cardurile
                    produselor.
                  </Text>
                </View>
              ) : null}

              {productList()}
            </View>
          }
        />
      );
    }

    if (page === 'productDetails') {
      return (
        <ProductDetailsScreen
          styles={styles}
          isLoading={isLoading}
          selectedProduct={selectedProduct}
          selectedVariantId={selectedVariantId}
          wishlist={wishlist}
          similarProducts={similarProducts}
          upsellProducts={upsellProducts}
          bundleProducts={bundleProducts}
          backInStockActive={
            !!(selectedProduct?.id && backInStockSubscriptions.has(selectedProduct.id))
          }
          hasImageUrl={hasImageUrl}
          onBack={goBackFromProductDetails}
          onOpenImageZoom={openImageZoom}
          onSetVariant={setSelectedVariantId}
          onAddToCart={addToCart}
          onToggleWishlist={toggleWishlist}
          onToggleBackInStock={toggleBackInStockAlert}
          onAddBundleToCart={addBundleToCart}
          onOpenProduct={openProduct}
        />
      );
    }

    if (page === 'cart') {
      return (
        <View style={styles.stackLarge}>
          <CartScreen
            styles={styles}
            isLoading={isLoading}
            cartItems={cartItems}
            cartTotal={cartTotal}
            cartError={
              typeof catalogError === 'string' &&
              (catalogError.trim().toLowerCase() === 'not found' || catalogError.includes('404'))
                ? null
                : catalogError
            }
            selectedAddress={selectedAddress}
            addressesCount={addresses.length}
            addressBusy={addressBusy}
            checkoutBusy={checkoutBusy}
            deliveryEtaLabel={deliveryEtaLabel}
            priceChangeExplanation={priceChangeExplanation}
            onChangeQuantity={changeQuantity}
            onRemoveLine={removeCartItem}
            onCheckout={handleCheckout}
            onOpenProducts={() => setPage('products')}
            onSelectOrAddAddress={() => {
              setAccountSegment('addresses');
              setPage('account');
              if (addresses.length === 0) {
                openCreateAddressEditor();
              }
            }}
            hasImageUrl={hasImageUrl}
          />

          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Liste salvate din coÈ™</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={saveCurrentCartAsList}>
              <Text style={styles.secondaryButtonText}>SalveazÄƒ coÈ™ul curent</Text>
            </TouchableOpacity>
            {savedCartLists.length === 0 ? (
              <Text style={styles.bodyMuted}>Nu existÄƒ liste salvate Ã®ncÄƒ.</Text>
            ) : (
              savedCartLists.slice(0, 5).map((list) => (
                <View key={list.id} style={styles.stackSmall}>
                  <Text style={styles.bodyText}>{list.name}</Text>
                  <Text style={styles.bodyMuted}>
                    {new Date(list.createdAt).toLocaleDateString('ro-RO')} â€¢ {list.lines.length}{' '}
                    produse
                  </Text>
                  <View style={styles.quickGrid}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => restoreCartList(list.id)}
                    >
                      <Text style={styles.secondaryButtonText}>RestaureazÄƒ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => removeSavedCartList(list.id)}
                    >
                      <Text style={styles.secondaryButtonText}>È˜terge</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      );
    }

    if (page === 'loyalty') {
      return (
        <LoyaltyScreen
          styles={styles}
          isLoading={isLoading}
          loyalty={loyalty}
          tierProgress={tierProgress}
          loyaltyRefreshing={loyaltyRefreshing}
          loyaltyBusy={loyaltyBusy}
          loyaltyRedeemPoints={loyaltyRedeemPoints}
          voucherValueRon={voucherValueRon}
          loyaltyTiers={loyaltyTiers}
          tierBenefitText={loyaltyTierBenefits[loyalty.tier]}
          voucherQrToken={voucherQrToken}
          loyaltyQrToken={loyaltyQrToken}
          loyaltyQrLoading={hasRequestedProfileQr && !loyaltyQrToken && !profileQrError}
          loyaltyQrError={profileQrError}
          onRefreshLoyalty={handleRefreshLoyalty}
          onRetryLoyaltyQr={retryLoadProfileQr}
          onSetRedeemPoints={setLoyaltyRedeemPoints}
          onOpenVoucherQrPreview={openVoucherQrPreview}
          onShareVoucher={handleShareVoucher}
          onOpenLoyaltyQrPreview={openLoyaltyQrPreview}
          onShareQrToken={handleShareQrToken}
          onRedeemVoucher={handleRedeemVoucher}
        />
      );
    }

    if (page === 'account') {
      return (
        <AccountScreen
          styles={styles}
          isLoading={isLoading}
          renderAccountSection={renderAccountSection}
        />
      );
    }

    if (page === 'settings') {
      return (
        <SettingsScreen
          styles={styles}
          isLoading={settingsLoading}
          isAuthenticated={!!accountUser}
          accountEmail={accountUser?.email ?? '-'}
          settings={effectiveAccountSettings}
          biometricEnabled={accountSettings.biometricLoginEnabled}
          onUpdateSettings={updateUnifiedAccountSettings}
          onToggleBiometricLogin={toggleBiometricLoginSetting}
          onChangePassword={runChangePassword}
          onOpenSessions={openDeviceSessions}
          onLogout={runLogout}
          onGoLogin={() => goToLogin('settings')}
        />
      );
    }

    return (
      <HomeScreen
        styles={styles}
        isLoading={isLoading}
        catalogError={catalogError}
        featuredCategories={[
          ...featuredCategories.filter((item) => favoriteCategoryIds.includes(item.id)),
          ...featuredCategories.filter((item) => !favoriteCategoryIds.includes(item.id)),
        ]}
        homeCategories={homeCategories}
        homeProducts={homeProducts}
        continueBrowsingProducts={continueBrowsingProducts}
        continueBrowsingCategories={continueBrowsingCategories}
        sectionsByCategory={sectionsByCategory}
        hasMoreCategories={homeCategories.length > HOME_SECTIONS_LIMIT}
        onOpenCategories={() => setPage('categories')}
        onOpenLoyalty={() => setPage('loyalty')}
        onOpenProducts={() => setPage('products')}
        onOpenCategory={openCategory}
        onOpenProduct={openProduct}
        onAddToCart={addToCart}
      />
    );
  };

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.headerWrap, isStandaloneAuthPage(page) && styles.headerWrapCompact]}>
        <View style={styles.headerTop}>
          {isStandaloneAuthPage(page) ? (
            <>
              <TouchableOpacity style={styles.backAuthButton} onPress={() => setPage('home')}>
                <MaterialCommunityIcons name="arrow-left" size={18} color={colors.brandBlack} />
                <Text style={styles.backAuthButtonText}>ÃŽnapoi</Text>
              </TouchableOpacity>
              <Text style={styles.authHeaderTitle}>
                {authScreenTitles[page as 'login' | 'register']}
              </Text>
              <View style={styles.authHeaderSpacer} />
            </>
          ) : (
            <>
              <Image source={dacusLogo} style={styles.logoImage} resizeMode="contain" />
              <TouchableOpacity style={styles.cartButton} onPress={() => setPage('cart')}>
                <MaterialCommunityIcons name="basket" size={16} color="#FFFFFF" />
                <Text style={styles.cartButtonText}>COÈ˜ {cartCount}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {isStandaloneAuthPage(page) ? (
          <Text style={styles.authHeaderSubtitle}>
            {authScreenSubtitles[page as 'login' | 'register']}
          </Text>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <AdvancedSearch
                value={searchQuery}
                onChangeText={handleSearchChange}
                onSubmit={handleSearchSubmit}
                onSelectSuggestion={handleSearchSubmit}
                suggestions={searchSuggestions}
                recentSearches={searchHistory}
                savedSearches={savedSearches}
                recentFilters={recentFilterSnapshots.map((item) => ({
                  id: item.id,
                  label: item.label,
                }))}
                trendingSearches={trendingSearches}
                onSaveSearch={saveSearchQuery}
                onSelectRecentFilter={applyRecentFilterSnapshot}
                placeholder="CautÄƒ produse, branduri, cod, SKU"
              />
            </View>
          </>
        )}
      </View>

      {undoRemoval ? (
        <View style={styles.undoBar}>
          <Text style={styles.undoBarText}>{`${undoRemoval.productName} a fost eliminat.`}</Text>
          <TouchableOpacity style={styles.undoButton} onPress={undoRemoveCartItem}>
            <Text style={styles.undoButtonText}>AnuleazÄƒ</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onScroll={onScrollMain}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        {renderPage()}
      </ScrollView>

      {cartCount > 0 && page !== 'cart' && !isStandaloneAuthPage(page) ? (
        <TouchableOpacity
          style={styles.floatingCart}
          onPress={() => setPage('cart')}
          activeOpacity={0.93}
        >
          <View>
            <Text style={styles.floatingCartTitle}>Ai {cartCount} produse Ã®n coÈ™</Text>
            <Text style={styles.floatingCartSub}>{formatPrice(cartTotal)}</Text>
          </View>
          <View style={styles.floatingCartActionWrap}>
            <MaterialCommunityIcons name="cart-check" size={16} color={colors.brandAmber} />
            <Text style={styles.floatingCartAction}>Vezi coÈ™</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={!!zoomImageUrl}
        transparent
        animationType="fade"
        onRequestClose={closeImageZoom}
      >
        <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={closeImageZoom}>
          <TouchableOpacity
            style={[styles.zoomClose, { top: zoomCloseTop + spacing.lg }]}
            onPress={closeImageZoom}
          >
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.zoomFrame} activeOpacity={1} onPress={() => undefined}>
            {zoomImageUrl ? (
              <Image
                source={{ uri: zoomImageUrl }}
                style={[
                  styles.zoomImage,
                  {
                    width: viewport.width * 0.9,
                    height: viewport.height * 0.65,
                    transform: [{ scale: zoomLevel }],
                  },
                ]}
                resizeMode="contain"
              />
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.zoomActions} activeOpacity={1} onPress={() => undefined}>
            <TouchableOpacity
              style={styles.zoomActionButton}
              onPress={() => setZoomLevel((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
            >
              <Text style={styles.zoomActionText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.zoomLevelText}>{Math.round(zoomLevel * 100)}%</Text>
            <TouchableOpacity
              style={styles.zoomActionButton}
              onPress={() => setZoomLevel((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
            >
              <Text style={styles.zoomActionText}>+</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={!!qrModalToken}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalToken(null)}
      >
        <TouchableOpacity
          style={styles.zoomOverlay}
          activeOpacity={1}
          onPress={() => setQrModalToken(null)}
        >
          <TouchableOpacity style={styles.qrModalCard} activeOpacity={1} onPress={() => undefined}>
            {qrModalToken ? <QRCodeMatrix value={qrModalToken} size={290} /> : null}
            <Text style={styles.qrModalHint}>ScaneazÄƒ acest QR la casÄƒ pentru validare.</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={addressEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAddressEditor}
      >
        <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={closeAddressEditor}>
          <TouchableOpacity
            style={styles.addressEditorCard}
            activeOpacity={1}
            onPress={() => undefined}
          >
            <Text style={styles.sectionLabel}>
              {addressEditorId ? 'EditeazÄƒ adresa' : 'AdaugÄƒ adresÄƒ nouÄƒ'}
            </Text>
            <ScrollView style={styles.addressFormScroll} contentContainerStyle={styles.stackSmall}>
              <Text style={styles.addressFieldLabel}>EtichetÄƒ *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="AcasÄƒ, Birou..."
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.label}
                onChangeText={(value) => updateAddressDraftValue('label', value)}
              />

              <Text style={styles.addressFieldLabel}>Nume complet *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Nume È™i prenume"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.fullName}
                onChangeText={(value) => updateAddressDraftValue('fullName', value)}
              />

              <Text style={styles.addressFieldLabel}>Telefon *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="07xxxxxxxx"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={addressDraft.phone}
                onChangeText={(value) => updateAddressDraftValue('phone', value)}
              />

              <Text style={styles.addressFieldLabel}>AdresÄƒ (linia 1) *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="StradÄƒ, numÄƒr"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.line1}
                onChangeText={(value) => updateAddressDraftValue('line1', value)}
              />

              <Text style={styles.addressFieldLabel}>AdresÄƒ (linia 2)</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Bloc, scarÄƒ, apartament"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.line2 ?? ''}
                onChangeText={(value) => updateAddressDraftValue('line2', value)}
              />

              <Text style={styles.addressFieldLabel}>OraÈ™ *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="OraÈ™"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.city}
                onChangeText={(value) => updateAddressDraftValue('city', value)}
              />

              <Text style={styles.addressFieldLabel}>JudeÈ› *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="JudeÈ›"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.county}
                onChangeText={(value) => updateAddressDraftValue('county', value)}
              />

              <Text style={styles.addressFieldLabel}>Cod poÈ™tal *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Cod poÈ™tal"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={addressDraft.postalCode}
                onChangeText={(value) => updateAddressDraftValue('postalCode', value)}
              />

              <Text style={styles.addressFieldLabel}>ÈšarÄƒ (cod) *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="RO"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.countryCode}
                autoCapitalize="characters"
                maxLength={2}
                onChangeText={(value) =>
                  updateAddressDraftValue('countryCode', value.toUpperCase())
                }
              />

              <Text
                style={styles.addressFieldLabel}
              >{`Calitate adresÄƒ: ${addressQualityScore}/100`}</Text>
              <View style={styles.addressQualityTrack}>
                <View style={[styles.addressQualityFill, { width: `${addressQualityScore}%` }]} />
              </View>

              {addressFormError ? (
                <Text style={styles.addressFormError}>{addressFormError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.accountInlineActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={closeAddressEditor}
                disabled={addressBusy}
              >
                <Text style={styles.secondaryButtonText}>RenunÈ›Äƒ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={submitAddressEditor}
                disabled={addressBusy}
              >
                <Text style={styles.primaryButtonText}>
                  {addressBusy ? 'Se salveazÄƒ...' : 'SalveazÄƒ adresa'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {showBackTop ? (
        <TouchableOpacity style={styles.backTopButton} onPress={backToTop} activeOpacity={0.9}>
          <MaterialCommunityIcons name="arrow-up" size={18} style={styles.backTopButtonText} />
        </TouchableOpacity>
      ) : null}

      {toastMessage ? (
        <View
          style={[
            styles.toast,
            toastTone === 'error' ? styles.toastError : styles.toastSuccess,
            { bottom: isStandaloneAuthPage(page) ? 18 : 84 },
          ]}
        >
          <MaterialCommunityIcons
            name={toastTone === 'error' ? 'alert-circle-outline' : 'check-circle-outline'}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      <Modal
        visible={showSessionManager}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSessionManager(false)}
      >
        <TouchableOpacity
          style={styles.zoomOverlay}
          activeOpacity={1}
          onPress={() => setShowSessionManager(false)}
        >
          <TouchableOpacity style={styles.qrModalCard} activeOpacity={1} onPress={() => undefined}>
            <Text style={styles.sectionLabel}>Sesiuni dispozitiv</Text>
            {deviceSessions.length === 0 ? (
              <Text style={styles.bodyMuted}>Nu existÄƒ sesiuni active.</Text>
            ) : (
              deviceSessions.map((session) => (
                <View key={session.id} style={styles.compareRow}>
                  <View style={styles.compareInfo}>
                    <Text
                      style={styles.bodyText}
                    >{`${String(session.platform ?? '').toUpperCase()} â€¢ ${session.deviceId}`}</Text>
                    <Text style={styles.bodyMuted}>
                      Ultima activitate: {new Date(session.lastSeenAt).toLocaleString('ro-RO')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => removeDeviceSession(session.id)}
                    disabled={session.current === true}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {session.current ? 'Curent' : 'RevocÄƒ'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showBiometricPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => handleBiometricPromptChoice(false)}
      >
        <TouchableOpacity
          style={styles.zoomOverlay}
          activeOpacity={1}
          onPress={() => handleBiometricPromptChoice(false)}
        >
          <TouchableOpacity style={styles.qrModalCard} activeOpacity={1} onPress={() => undefined}>
            <Text style={styles.sectionLabel}>Activezi login biometric?</Text>
            <Text style={styles.bodyMuted}>
              Pentru urmÄƒtoarele autentificÄƒri poÈ›i folosi Face ID / amprentÄƒ pe acest
              dispozitiv.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleBiometricPromptChoice(true)}
            >
              <Text style={styles.primaryButtonText}>Da, activeazÄƒ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleBiometricPromptChoice(false)}
            >
              <Text style={styles.secondaryButtonText}>Nu acum</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {isStandaloneAuthPage(page) ? null : (
        <NavigationBar currentPage={page} onNavigate={setPage} cartCount={cartCount} />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [fatalBootError, setFatalBootError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('[BOOT][App] mount', {
      dev: typeof __DEV__ !== 'undefined' ? __DEV__ : undefined,
      nodeEnv: process.env.NODE_ENV,
    });
    setAppReady(true);
    console.log('[BOOT][App] appReady set to true');
  }, []);

  useEffect(() => {
    if (!appReady) return;
    console.log('[BOOT][App] hiding splash screen');
    void SplashScreen.hideAsync().catch((error) => {
      console.warn('[BOOT][App] SplashScreen.hideAsync failed', error);
    });
  }, [appReady]);

  useEffect(() => {
    const errorUtils = (
      globalThis as {
        ErrorUtils?: {
          getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
          setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
        };
      }
    ).ErrorUtils;
    console.log('[BOOT][App] ErrorUtils availability', {
      hasSetGlobalHandler: Boolean(errorUtils?.setGlobalHandler),
    });
    if (!errorUtils?.setGlobalHandler) return;

    const previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error('Global runtime error', {
        isFatal: Boolean(isFatal),
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });

      if (isFatal) {
        setFatalBootError(error);
        void SplashScreen.hideAsync().catch(() => undefined);
        return;
      }

      previousHandler?.(error, isFatal);
    });

    return () => {
      if (previousHandler) {
        errorUtils.setGlobalHandler?.(previousHandler);
      }
    };
  }, []);

  if (!appReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.cardPlain, { margin: spacing.lg }]}>
          <Text style={styles.sectionLabel}>Se porneÈ™te aplicaÈ›ia</Text>
          <Text style={styles.bodyMuted}>
            IniÈ›ializÄƒm modulele necesare. DacÄƒ acest mesaj persistÄƒ, reporneÈ™te aplicaÈ›ia.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (fatalBootError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.cardPlain, { margin: spacing.lg }]}>
          <Text style={styles.sectionLabel}>AplicaÈ›ia a Ã®ntÃ¢mpinat o eroare criticÄƒ</Text>
          <Text style={styles.bodyMuted}>
            Te rugÄƒm sÄƒ Ã®nchizi È™i sÄƒ redeschizi aplicaÈ›ia. DacÄƒ problema persistÄƒ,
            reinstaleazÄƒ aplicaÈ›ia.
          </Text>
          <Text style={styles.bodyMuted}>{fatalBootError.message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Fatal render error', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <AppContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoImage: { width: 88, height: 30 },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#F4F5F7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: typography.body,
    paddingRight: 40,
  },
  clearSearchButton: {
    position: 'absolute',
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EBEF',
  },
  cartButton: {
    height: 34,
    minWidth: 78,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandRed,
  },
  cartButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  scroll: { flex: 1, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 140 },
  stackLarge: { gap: spacing.lg },
  stackSmall: { gap: spacing.sm },
  pageHeading: {
    fontSize: typography.h2,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  sectionLabel: {
    fontSize: typography.h3,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 24,
  },
  bodyText: { fontSize: typography.body, color: colors.textPrimary },
  bodyMuted: { fontSize: typography.body, color: colors.textSecondary },
  emptyText: { color: colors.textSecondary, fontSize: typography.body },
  errorText: { color: colors.brandRed, fontSize: typography.caption },
  homeHeroShell: {
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
    shadowColor: colors.brandBlack,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  homeHeroDiagonal: {
    position: 'absolute',
    left: -150,
    top: -70,
    width: 350,
    height: 420,
    backgroundColor: colors.brandRed,
    transform: [{ rotate: '-17deg' }],
  },
  homeHeroStripeOne: {
    position: 'absolute',
    left: 120,
    top: -35,
    width: 96,
    height: 170,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.26)',
    transform: [{ rotate: '-24deg' }],
  },
  homeHeroStripeTwo: {
    position: 'absolute',
    left: 152,
    top: -18,
    width: 84,
    height: 146,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-24deg' }],
  },
  homeHeroRedOrb: {
    position: 'absolute',
    top: -54,
    right: 36,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.brandRed,
    opacity: 0.95,
  },
  homeHeroLayout: {
    flexDirection: 'column',
    gap: spacing.sm,
    zIndex: 2,
  },
  homeHeroMediaWrap: {
    width: '100%',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  homeHeroMediaCard: {
    minHeight: 188,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  homeHeroMediaImage: {
    width: '100%',
    height: '100%',
  },
  homeHeroMediaFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeHeroMediaFallbackText: {
    color: colors.textInverted,
    fontSize: typography.h3,
    fontWeight: '900',
    letterSpacing: 1,
  },
  homeHeroPriceBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandRed,
    backgroundColor: colors.brandRed,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  homeHeroPriceCaption: {
    color: colors.textInverted,
    fontSize: typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  homeHeroPriceValue: {
    color: colors.textInverted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  homeHeroContent: {
    width: '100%',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  homeHeroEyebrow: {
    color: colors.brandBlack,
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  homeHeroTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 31,
    textTransform: 'uppercase',
  },
  homeHeroSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 18,
    fontWeight: '700',
  },
  homeHeroTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  homeHeroTag: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E8C5C9',
    backgroundColor: '#FFF8F9',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  homeHeroTagText: {
    color: colors.brandBlack,
    fontSize: typography.micro,
    fontWeight: '800',
  },
  homeHeroActions: {
    flexDirection: 'column',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  homeHeroPrimaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  homeHeroPrimaryButtonText: {
    color: colors.textInverted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  homeHeroGhostButton: {
    minHeight: 46,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E8C5C9',
    backgroundColor: '#FFF8F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  homeHeroGhostButtonText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  homeAlertCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#F5BFC5',
    backgroundColor: '#FFF3F5',
    padding: spacing.sm,
  },
  homeAlertText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  homeValueStrip: {
    gap: spacing.xs,
  },
  homeValuePill: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5EAF2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  homeValueTitle: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  homeValueMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '600',
  },
  homeSectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E6EBF3',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  homeCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  homeCategoryTile: {
    width: '48%',
    minHeight: 94,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5EAF2',
    backgroundColor: '#F8FAFD',
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  homeCategoryTileName: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  homeCategoryTileMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
  },
  homeShelfCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E6EBF3',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  homeTrustCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    padding: spacing.md,
    gap: spacing.sm,
  },
  homeTrustActions: {
    gap: spacing.sm,
  },
  quickGrid: { flexDirection: 'row', gap: spacing.md },
  quickCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  quickTitle: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '800' },
  quickSub: { fontSize: typography.caption, color: colors.textSecondary },
  homePromptCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFD',
    padding: spacing.md,
    gap: spacing.sm,
  },
  homePromptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  homePromptPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#DEE5F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  homePromptPillText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  homePromptActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  homePromptActionButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#F3C8CD',
    backgroundColor: '#FFF4F6',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  homePromptActionText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },

  heroCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceDark,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroEyebrow: {
    color: colors.brandAmber,
    fontSize: typography.caption,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: colors.textInverted,
    fontSize: typography.h1,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroSub: { color: '#CDD2DA', fontSize: typography.body, lineHeight: 20 },
  heroButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.brandRed,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.caption },

  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E9EE',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChipText: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: '700' },
  chipRow: { gap: spacing.sm, paddingRight: spacing.md },
  collectionScopeRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  collectionScopeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  collectionScopeButton: {
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandRed,
    backgroundColor: '#FFF2F3',
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionScopeButtonText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  rail: { gap: spacing.sm, paddingRight: spacing.md },
  railCardWrap: { width: 196 },

  catalogHeroCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    padding: spacing.md,
    gap: spacing.xs,
  },
  catalogHeroEyebrow: {
    color: colors.brandRed,
    fontSize: typography.micro,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  catalogHeroTitle: {
    color: colors.brandBlack,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  catalogHeroMeta: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  catalogHeroActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  productsCountPill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F4C4CA',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  productsCountPillText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  catalogActionPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  catalogActionPillActive: {
    backgroundColor: colors.brandRed,
    borderColor: colors.brandRed,
  },
  catalogActionPillText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  catalogActionPillTextActive: {
    color: colors.textInverted,
  },

  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  seeAll: { color: colors.brandRed, fontSize: typography.caption, fontWeight: '800' },

  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: spacing.md,
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  categoryContent: { flex: 1, gap: spacing.xxs },
  categoryTitle: { fontSize: typography.h3, fontWeight: '800', color: colors.textPrimary },
  categoryDescription: { fontSize: typography.body, color: colors.textSecondary },
  categoryMeta: { fontSize: typography.micro, color: colors.textSecondary, marginTop: spacing.xs },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  categoryFavoriteButton: {
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#D5D9E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFavoriteButtonActive: {
    borderColor: colors.brandRed,
    backgroundColor: '#FFF2F3',
  },
  categoryFavoriteButtonText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  categoryFavoriteButtonTextActive: {
    color: colors.brandRed,
  },
  categoryThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSoft,
  },
  categoryArrow: { fontSize: typography.h1, color: colors.textSecondary, marginLeft: spacing.md },

  filterChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#ECEFF4',
  },
  filterChipActive: { backgroundColor: colors.brandRed },
  filterChipText: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterPanel: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  filterIntroText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  filterHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterTitle: { fontSize: typography.body, color: colors.textPrimary, fontWeight: '800' },
  resetFilterButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#F5B7BC',
    backgroundColor: '#FFF2F3',
  },
  resetFilterText: { color: colors.brandRed, fontSize: typography.caption, fontWeight: '800' },
  filterLabel: { fontSize: typography.caption, color: colors.textSecondary, fontWeight: '700' },
  filterChipRow: { gap: spacing.xs, paddingRight: spacing.sm },
  filterPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterPillActive: { backgroundColor: colors.brandRed, borderColor: colors.brandRed },
  filterPillText: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700' },
  filterPillTextActive: { color: '#FFFFFF' },
  toggleRow: { flexDirection: 'row', gap: spacing.xs },
  toggleChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  toggleChipActive: { borderColor: colors.brandRed, backgroundColor: '#FFF2F3' },
  toggleChipText: { fontSize: typography.caption, color: colors.textPrimary, fontWeight: '700' },
  toggleChipTextActive: { color: colors.brandRed },
  filterSummary: { fontSize: typography.micro, color: colors.textSecondary },
  activeFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  activeFilterChip: {
    borderRadius: radii.pill,
    backgroundColor: '#ECEFF4',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  activeFilterChipText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '700',
  },

  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  gridListContent: { gap: spacing.sm },
  gridRow: { justifyContent: 'space-between' },
  gridCell: { width: '48.4%' },
  listWrap: { gap: spacing.sm },
  listCell: { width: '100%' },
  loadMoreButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  loadMoreButtonText: { color: colors.brandRed, fontSize: typography.caption, fontWeight: '800' },
  emptyStateCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyStateTitle: { fontSize: typography.h3, color: colors.textPrimary, fontWeight: '800' },
  emptyStateActions: { gap: spacing.sm },

  productCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productCardCompact: {
    minHeight: 258,
  },
  productCardTapArea: { flex: 1 },
  productMediaWrap: { width: '100%', backgroundColor: '#FAFBFC' },
  productMedia: {
    width: '100%',
    height: 124,
    backgroundColor: colors.surfaceSoft,
  },
  productMediaCompact: {
    height: 118,
  },
  productCardBody: {
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  discountBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.brandRed,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  discountBadgeText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900' },

  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },

  addButton: {
    backgroundColor: colors.brandRed,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xxs,
    borderRadius: radii.md,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.caption },

  productThumbSmall: {
    width: 62,
    height: 62,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
  },
  productInfo: { flex: 1, gap: spacing.xxs },
  productName: {
    fontSize: typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 17,
  },
  productBrand: { fontSize: typography.micro, color: colors.textSecondary, fontWeight: '700' },
  productSku: { fontSize: typography.micro, color: colors.textSecondary },
  productPrice: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '900' },
  productOldPrice: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stockPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  stockPillInStock: { backgroundColor: '#E8F5EE' },
  stockPillLimited: { backgroundColor: '#FFF7E0' },
  stockPillOutOfStock: { backgroundColor: '#FFE8EA' },
  stockPillText: { fontSize: typography.micro, fontWeight: '800' },
  stockPillTextInStock: { color: colors.success },
  stockPillTextLimited: { color: '#B57700' },
  stockPillTextOutOfStock: { color: colors.brandRed },

  detailsBackButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  detailsBackButtonText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  detailsShowcaseCard: {
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailsPurchaseCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailsShowcaseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailsBrandBadge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#F5C7CC',
    backgroundColor: '#FFF2F3',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  detailsBrandBadgeText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailsStockBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  detailsMedia: { height: 286, backgroundColor: colors.surfaceSoft, width: '100%' },
  detailsMediaFallback: {
    height: 286,
    backgroundColor: colors.surfaceSoft,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsMediaFallbackText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  detailsInfoCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailsTitle: { fontSize: typography.h2, fontWeight: '800', color: colors.textPrimary },
  detailsSub: { fontSize: typography.body, color: colors.textSecondary },
  detailsDescription: { fontSize: typography.body, color: colors.textPrimary, lineHeight: 20 },
  detailsPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  detailsPrice: { fontSize: typography.h1, color: colors.brandBlack, fontWeight: '900' },
  detailsOldPrice: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  detailsMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  detailsMetaPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E8EBF0',
    backgroundColor: '#F8F9FB',
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  detailsActions: { gap: spacing.sm },
  detailsSecondaryActionsRow: { gap: spacing.sm },
  detailsBackInStockButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  detailsBackInStockButtonText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  detailsActionsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    padding: spacing.md,
  },
  detailsHint: { color: colors.textSecondary, fontSize: typography.caption },
  primaryButton: {
    backgroundColor: colors.brandRed,
    borderRadius: radii.lg,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    shadowColor: '#8C0D15',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '800' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E8C5C9',
    backgroundColor: '#FFF8F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: { color: colors.brandRed, fontSize: typography.body, fontWeight: '800' },

  detailsHighlightsRow: { flexDirection: 'row', gap: spacing.sm },
  detailsHighlightCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  detailsHighlightTitle: {
    fontSize: typography.caption,
    fontWeight: '800',
    color: colors.brandBlack,
  },
  detailsHighlightText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  detailsSpecCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailsSpecRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
    paddingVertical: spacing.xs,
  },
  detailsSpecLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  detailsSpecValue: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: '800' },

  benefitRow: { flexDirection: 'row', gap: spacing.sm },
  benefitCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: '#F3F7FB',
    borderWidth: 1,
    borderColor: '#DEEAF8',
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  benefitTitle: { fontSize: typography.caption, fontWeight: '800', color: colors.info },
  benefitText: { fontSize: typography.caption, color: colors.textSecondary, lineHeight: 16 },

  cartRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cartCheckoutCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    padding: spacing.md,
    gap: spacing.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#E8C5C9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F9',
  },
  qtyRemoveButton: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E8C5C9',
    backgroundColor: '#FFF8F9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  qtyRemoveText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  qtyText: { color: colors.brandRed, fontWeight: '800', fontSize: typography.body },
  qtyValue: { minWidth: 20, textAlign: 'center', color: colors.textPrimary, fontWeight: '700' },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  totalLabel: { color: colors.textSecondary, fontSize: typography.body },
  totalValue: { color: colors.brandBlack, fontWeight: '900', fontSize: typography.h2 },

  loyaltyHero: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#2A2E36',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loyaltyHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyTierTag: {
    color: colors.brandAmber,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  loyaltyTitle: { color: '#FFFFFF', fontSize: typography.h3, fontWeight: '700' },
  loyaltyPoints: { color: '#FFFFFF', fontSize: typography.h1, fontWeight: '900' },
  loyaltyMeta: { color: '#D1D5DB', fontSize: typography.caption },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: '#2D3138',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brandAmber,
  },

  loyaltyStatRow: { flexDirection: 'row', gap: spacing.sm },
  loyaltyStatCard: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  loyaltyStatLabel: { fontSize: typography.caption, color: colors.textSecondary },
  loyaltyStatValue: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '900' },
  loyaltyActionRow: { gap: spacing.sm },
  loyaltyTokenActions: { gap: spacing.sm, marginTop: spacing.sm },
  profileQrSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
  },
  qrTapWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: {
    width: '100%',
    minHeight: 236,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  qrModalCard: {
    width: '88%',
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrModalHint: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    textAlign: 'center',
  },

  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  tierName: { fontSize: typography.body, color: colors.textPrimary, fontWeight: '700' },
  tierNameActive: { color: colors.brandRed },
  tierRange: { fontSize: typography.caption, color: colors.textSecondary },

  cardPlain: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  skeleton: {
    backgroundColor: colors.skeletonBase,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.skeletonShine,
  },
  bottomNav: {
    height: 68,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E6E9EE',
    flexDirection: 'row',
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  meta: { textAlign: 'center', fontSize: typography.caption, color: colors.textSecondary },

  floatingCart: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.brandRed,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingCartTitle: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  floatingCartSub: { color: '#FDE3E5', fontSize: typography.caption },
  floatingCartActionWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  floatingCartAction: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  undoBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 72,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: '#2D3138',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  undoBarText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  undoButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandAmber,
    backgroundColor: 'rgba(255,184,0,0.14)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  undoButtonText: {
    color: colors.brandAmber,
    fontSize: typography.caption,
    fontWeight: '800',
  },

  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 14, 20, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  zoomClose: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomFrame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  zoomImage: { maxWidth: '100%' },
  zoomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  zoomActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomActionText: { color: colors.brandRed, fontSize: typography.h2, fontWeight: '800' },
  zoomLevelText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center',
  },

  backTopButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: 146,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backTopButtonText: { color: colors.brandBlack },
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toastSuccess: {
    backgroundColor: '#1B8A5A',
  },
  toastError: {
    backgroundColor: colors.brandRed,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '700',
    flex: 1,
  },
  headerWrapCompact: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  backAuthButton: {
    minHeight: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  backAuthButtonText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  authHeaderTitle: { color: colors.textPrimary, fontSize: typography.h3, fontWeight: '800' },
  authHeaderSubtitle: { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 17 },
  authHeaderSpacer: { width: 68 },
  compareToolbar: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  comparePanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F5C7CC',
    backgroundColor: '#FFF7F8',
    padding: spacing.md,
    gap: spacing.sm,
  },
  comparePanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  comparePanelTitleWrap: {
    gap: spacing.xxs,
    flex: 1,
  },
  comparePanelTitle: {
    fontSize: typography.h3,
    color: colors.brandBlack,
    fontWeight: '900',
  },
  comparePanelMeta: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  compareClearButton: {
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandRed,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  compareClearButtonDisabled: {
    opacity: 0.45,
  },
  compareClearButtonText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  filterPresetWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  filterPresetDelete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCEBEC',
  },
  filterPresetDeleteText: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  compareInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  compareSelectRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  accountSegmentRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xxs,
    paddingBottom: spacing.xs,
  },
  accountSegmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#D5D9E1',
    backgroundColor: '#FFFFFF',
  },
  accountSegmentPillActive: {
    backgroundColor: colors.brandRed,
    borderColor: colors.brandRed,
  },
  accountSegmentText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  accountSegmentTextActive: {
    color: '#FFFFFF',
  },
  accountSegmentBadge: {
    marginLeft: spacing.xs,
    borderRadius: radii.pill,
    minWidth: 18,
    minHeight: 18,
    paddingHorizontal: spacing.xxs,
    backgroundColor: colors.semanticDangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountSegmentBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  accountSegmentBadgeText: {
    color: colors.brandRed,
    fontSize: typography.micro,
    fontWeight: '900',
  },
  accountSegmentBadgeTextActive: {
    color: colors.brandRed,
  },
  accountHeroCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#F2D2D6',
    backgroundColor: '#FFF8F9',
    padding: spacing.md,
    gap: spacing.sm,
  },
  accountHeroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandRed,
  },
  accountAvatarText: {
    color: '#FFFFFF',
    fontSize: typography.h3,
    fontWeight: '900',
  },
  accountHeroMetaWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  accountHeroName: {
    color: colors.brandBlack,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  accountHeroEmail: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  accountStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  accountStatCard: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#F5DDE0',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  accountStatLabel: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '700',
  },
  accountStatValue: {
    color: colors.brandBlack,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  accountQrPanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F5DDE0',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  accountQrHint: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    textAlign: 'center',
  },
  accountQrError: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
  },
  accountInlineActions: {
    gap: spacing.xs,
    flexDirection: 'row',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  settingInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  settingToggle: {
    minWidth: 58,
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#D6DAE1',
    backgroundColor: '#F3F5F8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  settingToggleActive: {
    borderColor: colors.brandRed,
    backgroundColor: '#FFF2F3',
  },
  settingToggleText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  settingToggleTextActive: {
    color: colors.brandRed,
  },
  accountListRow: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F4',
  },
  accountListMeta: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  orderTimelineRow: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  orderTimelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  orderTimelineDot: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  orderTimelineText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  journeyChecklist: {
    gap: spacing.sm,
  },
  journeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E8EBF0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  journeyItemDone: {
    borderColor: '#CFE9DA',
    backgroundColor: '#F4FBF7',
  },
  journeyItemIcon: {
    color: colors.success,
    fontSize: typography.h3,
    fontWeight: '900',
    width: 20,
    textAlign: 'center',
  },
  journeyItemMeta: {
    flex: 1,
    gap: spacing.xxs,
  },
  journeyActions: {
    gap: spacing.xs,
  },
  addressEditorCard: {
    width: '92%',
    maxWidth: 540,
    maxHeight: '86%',
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
    alignSelf: 'center',
  },
  addressFormScroll: {
    maxHeight: 460,
  },
  addressFieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#D6DAE1',
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    color: colors.brandBlack,
    fontSize: typography.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  addressFormError: {
    color: colors.brandRed,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  addressQualityTrack: {
    width: '100%',
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    overflow: 'hidden',
  },
  addressQualityFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { registerCatalogBackgroundTask } from './src/services/backgroundCatalogRefresh';
import { initFirebase } from './src/services/firebaseAuth';
import QRCodeMatrix from './src/components/QRCodeMatrix';
import {
  Share,
  Alert,
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dacusLogo = require('./assets/dacus-logo.png');
import { AdvancedSearch } from './src/components/AdvancedSearch';
import ErrorBoundary from './src/components/ErrorBoundary';
import { type CatalogCategory, type CatalogProduct } from './src/data/catalog';
import { LoginScreen } from './src/components/LoginScreen';
import { ProductCard } from './src/components/ProductCard';
import { RegisterScreen } from './src/components/RegisterScreen';
import { Skeleton } from './src/components/Skeleton';
import { NavigationBar } from './src/components/NavigationBar';
import { Ionicons } from '@expo/vector-icons';
import { useCatalog } from './src/hooks/useCatalog';
import { AccountScreen } from './src/screens/AccountScreen';
import { CartScreen } from './src/screens/CartScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
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
import { fixRomanianMojibake } from './src/utils/string';

type Page =
  | 'home'
  | 'categories'
  | 'products'
  | 'productDetails'
  | 'cart'
  | 'checkout'
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
  Bronze: 'Acumulare standard de puncte și acces la vouchere de bază.',
  Silver: 'Prioritate la campanii și oferte dedicate membrilor Silver.',
  Gold: 'Beneficii premium, prioritate maximă și suport preferențial.',
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
  created: 'Comandă plasată',
  processing: 'În procesare',
  shipped: 'Expediată',
};

const standaloneAuthPages: Page[] = ['login', 'register'];

const isStandaloneAuthPage = (value: Page) => standaloneAuthPages.includes(value);

const authScreenTitles: Record<'login' | 'register', string> = {
  login: 'Autentificare',
  register: 'Creează cont',
};

const authScreenSubtitles: Record<'login' | 'register', string> = {
  login: 'Conectează-te pentru a accesa comenzile, punctele și notificările.',
  register: 'Creează un cont nou pentru o experiență completă în aplicație.',
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

const safeText = (value: string | null | undefined) =>
  typeof value === 'string' ? fixRomanianMojibake(value) : value;

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
  if (input.priceFilter !== 'toate') chunks.push(`Preț ${input.priceFilter}`);
  if (input.onlyDiscount) chunks.push('Promoții');
  if (!input.onlyInStock) chunks.push('Include stoc epuizat');
  if (input.sortOption !== 'relevanta') chunks.push(`Sort ${input.sortOption}`);
  return chunks.join(' · ');
};

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppContent() {
  const [page, setPage] = useState<Page>('home');
  const pageFadeAnim = useRef(new Animated.Value(1)).current;
  const [previousPage, setPreviousPage] = useState<Page | null>(null);

  const smoothNavigate = useCallback(
    (newPage: Page) => {
      if (newPage === page) return;

      // Fade out current page
      Animated.timing(pageFadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setPreviousPage(page);
        setPage(newPage);

        // Fade in new page
        Animated.timing(pageFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [page, pageFadeAnim],
  );
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
  const [searchPreviewResults, setSearchPreviewResults] = useState<CatalogProduct[]>([]);
  const [searchPreviewLoading, setSearchPreviewLoading] = useState(false);
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
  const [checkoutAddressDraft, setCheckoutAddressDraft] = useState<AddressDraft | null>(null);
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

    // Initialize Firebase
    initFirebase();

    // Register background catalog refresh task
    void registerCatalogBackgroundTask();
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const pageScrollOffsetsRef = useRef<Record<Page, number>>({
    home: 0,
    categories: 0,
    products: 0,
    productDetails: 0,
    cart: 0,
    checkout: 0,
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
      hints.push({ label: 'Rezultate puține - încearcă filtre mai largi', tone: 'warning' });
    }
    if (availabilityFacetCounts.inStock > 0 && availabilityFacetCounts.outOfStock === 0) {
      hints.push({ label: 'Stoc excelent pentru selecția curentă', tone: 'success' });
    }
    if (availabilityFacetCounts.outOfStock > availabilityFacetCounts.inStock) {
      hints.push({ label: 'Multe produse au stoc limitat', tone: 'danger' });
    }
    if (searchQuery.trim().length > 0 && visibleCount > 20) {
      hints.push({ label: 'Rezultate bogate - folosește filtre inteligente', tone: 'info' });
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
    if (cartItems.length === 0) return 'Adaugă produse pentru estimare livrare.';
    const hasHighRisk = cartItems.some(
      (item) => item.stockRiskLabel?.includes('critic') || item.stockRiskLabel?.includes('ridicat'),
    );
    return hasHighRisk
      ? 'ETA livrare: 2-4 zile lucrătoare (stoc variabil)'
      : 'ETA livrare: 24-48h pentru majoritatea produselor';
  }, [cartItems]);

  const priceChangeExplanation = useMemo(() => {
    const changed = cartItems.filter((item) => {
      const base = item.product.priceRon;
      return Math.abs(item.unitPriceRon - base) >= 0.01;
    });
    if (changed.length === 0) return null;
    return `${changed.length} produs(e) au preț actualizat în coș (promoții sau variantă selectată).`;
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
    relevanta: 'Relevanță',
    pretCrescator: 'Preț crescător',
    pretDescrescator: 'Preț descrescător',
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
        setCatalogMeta('Codul de membru este pregătit pentru scanare.');
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
    if (page === 'productDetails') return;
    restoringScrollRef.current = true;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    pageScrollOffsetsRef.current[page] = 0;
    setShowBackTop(false);
    setTimeout(() => {
      restoringScrollRef.current = false;
    }, 60);
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
    void restoreAccount().then(async (user) => {
      if (!user) return;

      // Verify biometric if enabled
      if (accountSettings.biometricLoginEnabled) {
        const { authenticateWithBiometric } = await import('./src/services/biometric');
        const result = await authenticateWithBiometric('Autentifică-te pentru a accesa contul');
        if (!result.success) {
          console.log('[BOOT][Biometric] Verification failed, logging out');
          await logoutAccount();
          return;
        }
      }

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
    const effectiveCategoryId = searchQuery.trim().length === 0 ? selectedCategoryId : undefined;

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
          error instanceof Error ? error.message : 'Căutarea rapidă este indisponibilă momentan.',
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
            error instanceof Error ? error.message : 'Nu am putut elimina produsul din coș.';
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

    showToast('Produs restaurat în coș.');
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
    setSearchPreviewResults([]);
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
      setCatalogError('Autentifică-te pentru a filtra doar produsele favorite.');
      goToLogin('products');
      return;
    }
    setOnlyFavorites((prev) => !prev);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      setSearchPreviewLoading(true);
      void fetchSearchSuggestions(value)
        .then((items) => setSearchSuggestions(items))
        .catch((error) => {
          console.warn('[Search] Suggestions fetch failed', error);
          setSearchSuggestions([]);
        });

      void fetchProductSearch({
        query: value,
        page: 1,
        perPage: 6,
        sortBy: 'relevanta',
      })
        .then((payload) => {
          console.log('[Search] Preview results arrived', payload.products.length);
          setSearchPreviewResults(payload.products);
          upsertProducts(payload.products);
        })
        .catch((error) => {
          console.warn('[Search] Product search failed, using client-side fallback', error);
          // Fallback: client-side search through existing products
          const queryLower = value.trim().toLowerCase();
          const matches = products.filter((product) => {
            const nameMatch = product.name.toLowerCase().includes(queryLower);
            const brandMatch = product.brand.toLowerCase().includes(queryLower);
            const skuMatch = product.sku?.toLowerCase().includes(queryLower);
            const handleMatch = product.handle?.toLowerCase().includes(queryLower);
            return nameMatch || brandMatch || skuMatch || handleMatch;
          });
          console.log('[Search] Client-side fallback found', matches.length, 'matches');
          setSearchPreviewResults(matches.slice(0, 6));
        })
        .finally(() => setSearchPreviewLoading(false));
    } else {
      setSearchSuggestions([]);
      setSearchPreviewResults([]);
      setSearchPreviewLoading(false);
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

    void fetchSearchSuggestions(query)
      .then((items) => setSearchSuggestions(items))
      .catch(() => setSearchSuggestions([]));

    setSearchPreviewLoading(true);
    void fetchProductSearch({
      query,
      page: 1,
      perPage: 6,
      sortBy: 'relevanta',
    })
      .then((payload) => {
        setSearchPreviewResults(payload.products);
        upsertProducts(payload.products);
      })
      .catch((error) => {
        console.warn('[Search] Product search failed on submit, using fallback', error);
        const queryLower = query.toLowerCase();
        const matches = products.filter((product) => {
          const nameMatch = product.name.toLowerCase().includes(queryLower);
          const brandMatch = product.brand.toLowerCase().includes(queryLower);
          const skuMatch = product.sku?.toLowerCase().includes(queryLower);
          const handleMatch = product.handle?.toLowerCase().includes(queryLower);
          return nameMatch || brandMatch || skuMatch || handleMatch;
        });
        setSearchPreviewResults(matches.slice(0, 6));
      })
      .finally(() => setSearchPreviewLoading(false));
  };

  const handleSearchProductSelect = (productId: string) => {
    if (!productId) return;
    setSearchHistory((prev) => {
      const product = productsById.get(productId);
      const label = product?.name?.trim();
      if (!label) return prev;
      return [label, ...prev.filter((item) => item !== label)].slice(0, 8);
    });
    setSearchSuggestions([]);
    setSearchPreviewResults([]);
    openProduct(productId);
  };

  const saveSearchQuery = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setSavedSearches((prev) =>
      [normalized, ...prev.filter((item) => item !== normalized)].slice(0, 8),
    );
    showToast('Căutare salvată.');
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
      showToast('Autentifică-te pentru a gestiona sesiunile dispozitivului.', 'error');
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
        showToast('Sesiunea dispozitivului a fost revocată.');
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
        : 'Poți activa loginul biometric din Setări cont.',
    );
  };

  const toggleBiometricLoginSetting = async () => {
    const currentEnabled = accountSettings.biometricLoginEnabled;

    // If turning OFF, just disable without verification
    if (currentEnabled) {
      persistPreferences((current) => ({
        ...current,
        accountSettings: {
          ...current.accountSettings,
          biometricLoginEnabled: false,
          biometricPromptShown: true,
        },
      }));
      showToast('Login biometric dezactivat.');
      return;
    }

    // If turning ON, verify biometric first
    const { isBiometricAvailable, authenticateWithBiometric } =
      await import('./src/services/biometric');

    const available = await isBiometricAvailable();
    if (!available) {
      showToast('Biometric nu este disponibil pe acest dispozitiv.');
      return;
    }

    const result = await authenticateWithBiometric('Activează login-ul biometric');
    if (result.success) {
      persistPreferences((current) => ({
        ...current,
        accountSettings: {
          ...current.accountSettings,
          biometricLoginEnabled: true,
          biometricPromptShown: true,
        },
      }));
      showToast('Login biometric activat.');
    } else {
      showToast(result.error || 'Nu am putut activa login-ul biometric.');
    }
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
      setCatalogError('Autentifică-te pentru a genera codul QR de fidelitate.');
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
      showToast('Coșul este gol. Nu există nimic de salvat.', 'error');
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
    showToast('Coșul a fost salvat ca listă.');
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
          showToast(`Listă restaurată: ${list.name}`);
        })
        .catch((error) => {
          setCart(previousCart);
          const message =
            error instanceof Error ? error.message : 'Nu am putut restaura lista în coș.';
          showToast(message, 'error');
        });
      return;
    }
    showToast(`Listă restaurată: ${list.name}`);
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
    showToast('Preferințele tale au fost salvate.');
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
      const addressLabel = cached?.address?.label ?? 'fără adresă';
      showToast(`Detalii comandă: ${orderId} · ${addressLabel}`);
      return;
    }

    void fetchOrderDetails(orderId)
      .then((payload) => {
        setOrderDetailsById((prev) => ({
          ...prev,
          [orderId]: payload,
        }));
        const addressLabel = payload.address?.label ?? 'fără adresă';
        showToast(`Detalii comandă încărcate: ${addressLabel}`);
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Nu am putut încărca detaliile comenzii.';
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
              Autentifică-te pentru comenzi, puncte, adrese și setări personalizate.
            </Text>
            <View style={styles.stackSmall}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => goToLogin()}>
                <Text style={styles.primaryButtonText}>Intră în cont</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => goToRegister()}>
                <Text style={styles.secondaryButtonText}>Creează cont nou</Text>
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
        label: 'Preferințe personalizate configurate',
        done: preferenceOnboarding.completed,
      },
      { id: 'address', label: 'Adresă de livrare salvată', done: addresses.length > 0 },
      { id: 'qr', label: 'Cod QR fidelitate activ', done: Boolean(loyaltyQrToken) },
      { id: 'order', label: 'Prima comandă plasată', done: orders.length > 0 },
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
      { id: 'privacy', label: 'Confidențialitate' },
      {
        id: 'journey',
        label: 'Ghid',
        ...(journeyPendingCount > 0 ? { badge: journeyPendingCount } : {}),
      },
    ];

    return (
      <View style={styles.stackLarge}>
        {/* Account Header Card */}
        <View style={styles.accountHeaderCard}>
          <View style={styles.accountProfileSection}>
            <View style={styles.accountAvatarContainer}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>{initials || 'DC'}</Text>
              </View>
              <TouchableOpacity style={styles.editProfileButton}>
                <MaterialCommunityIcons name="pencil" size={16} color={colors.brandBlue} />
              </TouchableOpacity>
            </View>

            <View style={styles.accountProfileInfo}>
              <Text style={styles.accountName}>{accountName || 'Utilizator Dacus'}</Text>
              <Text style={styles.accountEmail}>{accountUser.email || '-'}</Text>
              <View style={styles.accountMembershipBadge}>
                <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
                <Text style={styles.accountMembershipText}>
                  {loyalty.tier === 'Gold'
                    ? 'Membru Gold'
                    : loyalty.tier === 'Silver'
                      ? 'Membru Silver'
                      : 'Membru Bronze'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.accountStatsGrid}>
            <View style={styles.accountStatItem}>
              <MaterialCommunityIcons name="star-circle" size={24} color="#F59E0B" />
              <Text style={styles.accountStatNumber}>{loyalty.points.toLocaleString('ro-RO')}</Text>
              <Text style={styles.accountStatLabel}>Puncte</Text>
            </View>
            <View style={styles.accountStatItem}>
              <MaterialCommunityIcons name="cellphone-check" size={24} color="#10B981" />
              <Text style={styles.accountStatNumber}>{deviceSessions.length}</Text>
              <Text style={styles.accountStatLabel}>Dispozitive</Text>
            </View>
            <View style={styles.accountStatItem}>
              <MaterialCommunityIcons name="package-variant-closed" size={24} color="#3B82F6" />
              <Text style={styles.accountStatNumber}>{orders.length}</Text>
              <Text style={styles.accountStatLabel}>Comenzi</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.accountQuickActions}>
            <TouchableOpacity style={styles.quickActionButton} onPress={() => setPage('loyalty')}>
              <MaterialCommunityIcons name="medal" size={20} color="#F59E0B" />
              <Text style={styles.quickActionText}>Fidelitate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={() => setPage('settings')}>
              <MaterialCommunityIcons name="cog" size={20} color="#6B7280" />
              <Text style={styles.quickActionText}>Setări</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={openDeviceSessions}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
              <Text style={styles.quickActionText}>Securitate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Member QR Code Section */}
        <View style={styles.accountQrSection}>
          <View style={styles.accountQrHeader}>
            <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.brandBlue} />
            <Text style={styles.sectionLabel}>Cod membru</Text>
          </View>

          {loyaltyQrToken ? (
            <TouchableOpacity
              style={styles.accountQrContainer}
              activeOpacity={0.9}
              onPress={openLoyaltyQrPreview}
            >
              <View style={styles.accountQrPreview}>
                <QRCodeMatrix value={loyaltyQrToken} size={120} />
              </View>
              <View style={styles.accountQrInfo}>
                <Text style={styles.accountQrTitle}>Codul tău personal</Text>
                <Text style={styles.accountQrSubtitle}>Scanează la casă pentru beneficii</Text>
                <View style={styles.accountQrAction}>
                  <MaterialCommunityIcons name="eye" size={16} color={colors.brandBlue} />
                  <Text style={styles.accountQrActionText}>Apasă pentru mărire</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : hasRequestedProfileQr ? (
            <View style={styles.accountQrLoading}>
              <MaterialCommunityIcons name="loading" size={32} color={colors.brandBlue} />
              <Text style={styles.accountQrLoadingText}>Se generează codul...</Text>
            </View>
          ) : profileQrError ? (
            <View style={styles.accountQrError}>
              <MaterialCommunityIcons name="barcode-off" size={32} color="#EF4444" />
              <Text style={styles.accountQrErrorText}>{profileQrError}</Text>
              <TouchableOpacity style={styles.accountQrRetryButton} onPress={retryLoadProfileQr}>
                <Text style={styles.accountQrRetryText}>Reîncearcă</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.accountQrGenerateButton} onPress={retryLoadProfileQr}>
              <MaterialCommunityIcons name="qrcode-plus" size={32} color={colors.brandBlue} />
              <Text style={styles.accountQrGenerateText}>Generează codul QR</Text>
            </TouchableOpacity>
          )}
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
                      {wishlist.has(product.id) ? '★' : '☆'} {safeText(product.name)}
                    </Text>
                    <Text style={styles.accountListMeta}>
                      {safeText(product.brand)} · {formatPrice(product.priceRon)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.cardPlain}>
              <Text style={styles.sectionLabel}>Inbox notificări</Text>
              {inbox.length === 0 ? (
                <Text style={styles.bodyMuted}>Nu ai notificări.</Text>
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
                    <Text style={styles.bodyText}>{safeText(note.title)}</Text>
                    <Text style={styles.bodyMuted}>{safeText(note.message)}</Text>
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
              <Text style={styles.bodyMuted}>Nu ai comenzi încă.</Text>
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
                    ? ['Comandă plasată']
                    : order.status === 'processing'
                      ? ['Comandă plasată', 'În procesare']
                      : ['Comandă plasată', 'În procesare', 'Expediată'];

                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.accountListRow}
                    onPress={() => handleOpenOrderDetails(order.id)}
                  >
                    <Text style={styles.bodyText}>{order.id}</Text>
                    <Text style={styles.accountListMeta}>
                      {orderStatusLabels[order.status]} · {formatPrice(order.totalRon)}
                    </Text>
                    {trackingCode && (
                      <Text style={styles.accountListMeta}>{`Tracking: ${trackingCode}`}</Text>
                    )}
                    {detailAddressLabel && (
                      <Text style={styles.accountListMeta}>{`Adresă: ${detailAddressLabel}`}</Text>
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
                      {address.fullName} · {address.phone}
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
                          {active ? 'Implicită' : 'Setează implicită'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => openEditAddressEditor(address)}
                        disabled={addressBusy}
                      >
                        <Text style={styles.secondaryButtonText}>Editează</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => handleDeleteAddress(address.id)}
                        disabled={addressBusy}
                      >
                        <Text style={styles.secondaryButtonText}>Șterge</Text>
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
                {addressBusy ? 'Se actualizează...' : 'Adaugă adresă'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {accountSegment === 'privacy' ? (
          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Setări cont și confidențialitate</Text>
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
              Finalizează pașii de mai jos pentru o experiență completă și personalizată.
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
                    <Text style={styles.bodyMuted}>{item.done ? 'Completat' : 'În așteptare'}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.journeyActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('products')}>
                <Text style={styles.secondaryButtonText}>Explorează produse</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('loyalty')}>
                <Text style={styles.secondaryButtonText}>Vezi fidelitatea</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setAccountSegment('addresses')}
              >
                <Text style={styles.secondaryButtonText}>Configurează adrese</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setPage('settings')}>
                <Text style={styles.secondaryButtonText}>Setări confidențialitate</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const handleCheckout = () => {
    if (!accountUser) {
      setCatalogError('Autentifică-te înainte de checkout.');
      goToLogin();
      return;
    }

    if (!selectedAddressId && !checkoutAddressDraft) {
      setCatalogError('Adaugă o adresă de livrare pentru checkout.');
      showToast('Trebuie să adaugi o adresă de livrare.', 'error');
      return;
    }

    if (checkoutAddressDraft) {
      const addr = checkoutAddressDraft;
      if (
        !addr.fullName?.trim() ||
        !addr.phone?.trim() ||
        !addr.line1?.trim() ||
        !addr.city?.trim() ||
        !addr.county?.trim() ||
        !addr.postalCode?.trim()
      ) {
        setCatalogError('Completează toate câmpurile pentru adresă.');
        showToast('Completează toate câmpurile adresei.', 'error');
        return;
      }
    }

    // Show checkout page first for order summary
    setPage('checkout');
  };

  const processCheckout = () => {
    setCheckoutBusy(true);
    void validateCart()
      .then((validation) => {
        if (!validation.ok) {
          const firstIssue = validation.issues[0];
          throw new Error(
            firstIssue?.messageRo ??
              firstIssue?.message ??
              'Coșul trebuie actualizat înainte de checkout.',
          );
        }

        setCart(validation.lines);
        return checkoutCart(
          selectedAddressId
            ? { addressId: selectedAddressId }
            : { address: checkoutAddressDraft ?? undefined },
        );
      })
      .then((payload) => {
        setCatalogMeta(`Checkout inițiat: ${payload.orderId}`);
        showToast(`Comandă plasată: ${formatPrice(payload.totalRon)}`);
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
      showToast(`Bundle adăugat în coș (${uniqueIds.length} produse).`);
    }
  };

  const toggleBackInStockAlert = (productId: string) => {
    if (!accountUser) {
      showToast('Autentifică-te pentru alerte de stoc.', 'error');
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
            ? 'Alerta de stoc a fost dezactivată.'
            : 'Te anunțăm când revine în stoc.',
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
      setAddressFormError('Completează toate câmpurile obligatorii.');
      return;
    }

    if (nextDraft.phone.replace(/\D/g, '').length < 9) {
      setAddressFormError('Numărul de telefon este invalid.');
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
        showToast(editingAddressId ? 'Adresa a fost actualizată.' : 'Adresă de livrare adăugată.');
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
        showToast('Adresa de livrare a fost actualizată.');
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
        showToast('Adresă eliminată.');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Nu am putut șterge adresa.';
        setCatalogError(message);
        showToast(message, 'error');
      })
      .finally(() => setAddressBusy(false));
  };

  const handleRedeemVoucher = () => {
    if (!accountUser) {
      setCatalogError('Autentifică-te pentru a genera voucherul de fidelitate.');
      goToLogin('loyalty');
      return;
    }

    if (loyalty.points < loyaltyRedeemPoints) {
      setCatalogError('Nu ai suficiente puncte pentru valoarea selectată.');
      return;
    }

    setLoyaltyBusy(true);
    void redeemLoyaltyVoucher(loyaltyRedeemPoints)
      .then((payload) => {
        setLoyalty(payload.summary);
        setVoucherQrToken(payload.voucher.qrToken ?? null);
        setCatalogMeta(`Voucher generat: ${payload.voucher.code}`);
        showToast('Voucherul a fost generat și are QR dedicat pentru scanare în magazin.');
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
      setCatalogError('Autentifică-te pentru a actualiza datele de fidelitate.');
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
          error instanceof Error ? error.message : 'Actualizarea fidelității a eșuat momentan.',
        ),
      )
      .finally(() => setLoyaltyRefreshing(false));
  };

  const handleShareVoucher = () => {
    if (!loyalty.lastVoucher?.code || !voucherQrToken) {
      setCatalogError('Nu există voucher activ cu QR pentru partajare.');
      return;
    }

    void Share.share({
      message: `Voucher Dacus: ${loyalty.lastVoucher.code} · ${formatPrice(loyalty.lastVoucher.valueRon)} · Cod scanare: ${voucherQrToken}`,
    }).catch(() => setCatalogError('Partajarea voucherului nu a reușit momentan.'));
  };

  const openVoucherQrPreview = () => {
    if (!voucherQrToken) {
      setCatalogError('Nu există QR de voucher activ.');
      return;
    }
    setQrModalToken(voucherQrToken);
  };

  const openLoyaltyQrPreview = () => {
    if (!loyaltyQrToken) {
      setCatalogError('Nu există QR de fidelitate activ.');
      return;
    }
    setQrModalToken(loyaltyQrToken);
  };

  const handleShareQrToken = () => {
    if (!loyaltyQrToken) {
      setCatalogError('Nu există cod de membru activ pentru partajare.');
      return;
    }

    void Share.share({
      message: `Cod de membru fidelitate Dacus: ${loyaltyQrToken}`,
    }).catch(() => setCatalogError('Partajarea codului de membru nu a reușit momentan.'));
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
      setAuthError('Completează email și parolă.');
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
          showToast('Autentificare reușită. Bine ai revenit!');
          void registerDeviceForNotifications(`ios-${Date.now()}`, 'ios').catch(() => undefined);
        },
      )
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Autentificare eșuată. Verifică datele și încearcă din nou.';
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
      setAuthError('Completează toate câmpurile pentru înregistrare.');
      return;
    }

    if (!email.includes('@')) {
      setAuthError('Email invalid.');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Parola trebuie să aibă minimum 6 caractere.');
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
            : 'Înregistrare eșuată. Verifică datele și încearcă din nou.';
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
      const effectiveCategoryId = searchQuery.trim().length === 0 ? selectedCategoryId : undefined;

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
            error instanceof Error ? error.message : 'Nu s-au putut încărca mai multe produse.',
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
          <Text style={styles.emptyStateTitle}>Nu există produse pentru filtrarea curentă</Text>
          <Text style={styles.emptyText}>
            Încearcă să resetezi filtrele sau să alegi o categorie diferită.
          </Text>
          <View style={styles.emptyStateActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={resetFilters}>
              <Text style={styles.secondaryButtonText}>Resetează filtrele</Text>
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
                {productsLoadingMore ? 'Se încarcă...' : 'Afișează mai multe produse'}
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

    if (page === 'checkout') {
      return (
        <CheckoutScreen
          styles={styles}
          isLoading={false}
          isProcessing={checkoutBusy}
          cartItems={cartItems}
          cartTotal={cartTotal}
          selectedAddress={selectedAddress}
          addressDraft={checkoutAddressDraft}
          onGoBack={() => setPage('cart')}
          onConfirmCheckout={processCheckout}
          onOpenExternalCheckout={(url) => {
            Alert.alert(
              'Redirecționare la plată',
              'Vei fi redirecționat către pagina de plată Shopify. După plată, vei primi un email de confirmare.',
              [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Continuă', onPress: () => Linking.openURL(url).catch(() => undefined) },
              ],
            );
          }}
        />
      );
    }

    if (page === 'products') {
      return (
        <ProductsScreen
          styles={styles}
          selectedCategoryName={safeText(selectedCategory?.name) ?? 'Produse'}
          searchQuery={safeText(searchQuery) ?? ''}
          productsTotalForView={productsTotalForView}
          filteredProductsCount={filteredProducts.length}
          sortLabel={safeText(sortLabelMap[sortOption]) ?? ''}
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
                  <Text style={styles.secondaryButtonText}>Salvează preset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setCompareMode((prev) => !prev)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {compareMode ? 'Ieși din comparare' : 'Compare mode'}
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
                        <Text style={styles.filterPresetDeleteText}>×</Text>
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
                      <Text style={styles.compareClearButtonText}>Golește</Text>
                    </TouchableOpacity>
                  </View>

                  {compareProducts.length === 0 ? (
                    <Text style={styles.bodyMuted}>
                      Selectează produse din lista de mai jos pentru comparație.
                    </Text>
                  ) : (
                    compareProducts.map((product) => (
                      <View key={product.id} style={styles.compareRow}>
                        <View style={styles.compareInfo}>
                          <Text style={styles.bodyText}>{safeText(product.name)}</Text>
                          <Text style={styles.bodyMuted}>
                            {safeText(product.brand)} · {formatPrice(product.priceRon)} ·{' '}
                            {safeText(product.stockLabel)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => toggleCompareProduct(product.id)}
                        >
                          <Text style={styles.secondaryButtonText}>Elimină</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                  <Text style={styles.bodyMuted}>
                    Pentru selecție rapidă folosește badge-ul „Compară” din cardurile produselor.
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
            checkoutAddressDraft={checkoutAddressDraft}
            onUpdateCheckoutAddressField={(field, value) => {
              const current = checkoutAddressDraft ?? {
                label: 'Livrare',
                fullName: '',
                phone: '',
                line1: '',
                line2: '',
                city: '',
                county: '',
                postalCode: '',
                countryCode: 'RO',
              };
              setCheckoutAddressDraft({ ...current, [field]: value });
            }}
            hasImageUrl={hasImageUrl}
          />

          <View style={styles.cardPlain}>
            <Text style={styles.sectionLabel}>Liste salvate din coș</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={saveCurrentCartAsList}>
              <Text style={styles.secondaryButtonText}>Salvează coșul curent</Text>
            </TouchableOpacity>
            {savedCartLists.length === 0 ? (
              <Text style={styles.bodyMuted}>Nu există liste salvate încă.</Text>
            ) : (
              savedCartLists.slice(0, 5).map((list) => (
                <View key={list.id} style={styles.stackSmall}>
                  <Text style={styles.bodyText}>{list.name}</Text>
                  <Text style={styles.bodyMuted}>
                    {new Date(list.createdAt).toLocaleDateString('ro-RO')} · {list.lines.length}{' '}
                    produse
                  </Text>
                  <View style={styles.quickGrid}>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => restoreCartList(list.id)}
                    >
                      <Text style={styles.secondaryButtonText}>Restaurează</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => removeSavedCartList(list.id)}
                    >
                      <Text style={styles.secondaryButtonText}>Șterge</Text>
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
          tierBenefitText={safeText(loyaltyTierBenefits[loyalty.tier]) ?? ''}
          voucherQrToken={voucherQrToken}
          loyaltyQrToken={loyaltyQrToken}
          loyaltyQrLoading={hasRequestedProfileQr && !loyaltyQrToken && !profileQrError}
          loyaltyQrError={safeText(profileQrError) ?? null}
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
          accountEmail={safeText(accountUser?.email) ?? '-'}
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
                <Ionicons name="arrow-back" size={18} color={colors.brandBlack} />
                <Text style={styles.backAuthButtonText}>Înapoi</Text>
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
                <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                <Text style={styles.cartButtonText}>COȘ {cartCount}</Text>
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
                productResults={searchPreviewResults.map((item) => ({
                  id: item.id,
                  name: safeText(item.name) ?? item.name,
                  brand: safeText(item.brand) ?? item.brand,
                  priceRon: item.priceRon,
                  stockLabel: safeText(item.stockLabel) ?? undefined,
                  imageUrl: item.imageUrl,
                  thumbnailUrl: item.thumbnailUrl,
                }))}
                recentSearches={searchHistory}
                savedSearches={savedSearches}
                recentFilters={recentFilterSnapshots.map((item) => ({
                  id: item.id,
                  label: safeText(item.label) ?? item.label,
                }))}
                trendingSearches={trendingSearches}
                loading={searchPreviewLoading}
                onSaveSearch={saveSearchQuery}
                onSelectRecentFilter={applyRecentFilterSnapshot}
                onSelectProduct={handleSearchProductSelect}
                placeholder="Caută produse, branduri, cod, SKU"
              />
            </View>
          </>
        )}
      </View>

      {undoRemoval ? (
        <View style={styles.undoBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="trash-outline" size={16} color={colors.brandRed} />
            <Text style={styles.undoBarText}>{`${undoRemoval.productName} a fost eliminat.`}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.undoButton,
              { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
            ]}
            onPress={undoRemoveCartItem}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={colors.brandRed} />
            <Text style={styles.undoButtonText}>Anulează</Text>
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
        <Animated.View style={[styles.pageContainer, { opacity: pageFadeAnim }]}>
          {renderPage()}
        </Animated.View>
      </ScrollView>

      {cartCount > 0 && page !== 'cart' && !isStandaloneAuthPage(page) ? (
        <TouchableOpacity
          style={styles.floatingCart}
          onPress={() => setPage('cart')}
          activeOpacity={0.93}
        >
          <View>
            <Text style={styles.floatingCartTitle}>Ai {cartCount} produse în coș</Text>
            <Text style={styles.floatingCartSub}>{formatPrice(cartTotal)}</Text>
          </View>
          <View style={styles.floatingCartActionWrap}>
            <Ionicons name="cart" size={16} color={colors.brandAmber} />
            <Text style={styles.floatingCartAction}>Vezi coș</Text>
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
            <Text style={styles.qrModalHint}>Scanează acest QR la casă pentru validare.</Text>
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
              {addressEditorId ? 'Editează adresa' : 'Adaugă adresă nouă'}
            </Text>
            <ScrollView style={styles.addressFormScroll} contentContainerStyle={styles.stackSmall}>
              <Text style={styles.addressFieldLabel}>Etichetă *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Acasă, Birou..."
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.label}
                onChangeText={(value) => updateAddressDraftValue('label', value)}
              />

              <Text style={styles.addressFieldLabel}>Nume complet *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Nume și prenume"
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

              <Text style={styles.addressFieldLabel}>Adresă (linia 1) *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Stradă, număr"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.line1}
                onChangeText={(value) => updateAddressDraftValue('line1', value)}
              />

              <Text style={styles.addressFieldLabel}>Adresă (linia 2)</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Bloc, scară, apartament"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.line2 ?? ''}
                onChangeText={(value) => updateAddressDraftValue('line2', value)}
              />

              <Text style={styles.addressFieldLabel}>Oraș *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Oraș"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.city}
                onChangeText={(value) => updateAddressDraftValue('city', value)}
              />

              <Text style={styles.addressFieldLabel}>Județ *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Județ"
                placeholderTextColor={colors.textSecondary}
                value={addressDraft.county}
                onChangeText={(value) => updateAddressDraftValue('county', value)}
              />

              <Text style={styles.addressFieldLabel}>Cod poștal *</Text>
              <TextInput
                style={styles.addressInput}
                placeholder="Cod poștal"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={addressDraft.postalCode}
                onChangeText={(value) => updateAddressDraftValue('postalCode', value)}
              />

              <Text style={styles.addressFieldLabel}>Țară (cod) *</Text>
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
              >{`Calitate adresă: ${addressQualityScore}/100`}</Text>
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
                <Text style={styles.secondaryButtonText}>Renunță</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={submitAddressEditor}
                disabled={addressBusy}
              >
                <Text style={styles.primaryButtonText}>
                  {addressBusy ? 'Se salvează...' : 'Salvează adresa'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {showBackTop ? (
        <TouchableOpacity style={styles.backTopButton} onPress={backToTop} activeOpacity={0.9}>
          <Ionicons name="arrow-up" size={18} color={colors.brandBlack} />
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
              <Text style={styles.bodyMuted}>Nu există sesiuni active.</Text>
            ) : (
              deviceSessions.map((session) => (
                <View key={session.id} style={styles.compareRow}>
                  <View style={styles.compareInfo}>
                    <Text
                      style={styles.bodyText}
                    >{`${String(session.platform ?? '').toUpperCase()} · ${session.deviceId}`}</Text>
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
                      {session.current ? 'Curent' : 'Revocă'}
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
              Pentru următoarele autentificări poți folosi Face ID / amprentă pe acest dispozitiv.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleBiometricPromptChoice(true)}
            >
              <Text style={styles.primaryButtonText}>Da, activează</Text>
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
        <NavigationBar currentPage={page} onNavigate={smoothNavigate} cartCount={cartCount} />
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
          <Text style={styles.sectionLabel}>Se pornește aplicația</Text>
          <Text style={styles.bodyMuted}>
            Inițializăm modulele necesare. Dacă acest mesaj persistă, repornește aplicația.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (fatalBootError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.cardPlain, { margin: spacing.lg }]}>
          <Text style={styles.sectionLabel}>Aplicația a întâmpinat o eroare critică</Text>
          <Text style={styles.bodyMuted}>
            Te rugăm să închizi și să redeschizi aplicația. Dacă problema persistă, reinstalează
            aplicația.
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
    zIndex: 100,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 72,
    gap: spacing.sm,
  },
  logoImage: { width: 153, height: 53, marginRight: 'auto' },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
    zIndex: 101,
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
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 140 },
  stackLarge: { gap: spacing.lg },
  stackSmall: { gap: spacing.sm, flex: 1, minWidth: 0 },
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
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandRed,
  },
  homeHeroCarousel: {
    paddingRight: 0,
  },
  homeHeroSlide: {
    width: '100%',
  },
  homeHeroLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  homeHeroMediaWrap: {
    flex: 1,
  },
  homeHeroMediaCard: {
    width: '100%',
    height: 176,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
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
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  homeHeroContent: {
    gap: spacing.sm,
  },
  homeHeroContentPanel: {
    flex: 1,
    justifyContent: 'space-between',
    height: 176,
  },
  homeHeroTextBlock: {
    gap: spacing.xs,
  },
  homeHeroTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  homeHeroPriceBlock: {
    gap: 4,
  },
  homeHeroPriceLabel: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  homeHeroPriceMain: {
    color: colors.brandRed,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  homeHeroPrimaryButton: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-end',
    minWidth: 136,
    marginTop: spacing.xs,
  },
  homeHeroPrimaryButtonText: {
    color: colors.textInverted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  homeHeroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  homeHeroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E3B7BF',
  },
  homeHeroDotActive: {
    width: 20,
    backgroundColor: colors.brandRed,
  },
  homeAlertCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
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
  homeBodyGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  homePrimaryColumn: {
    flex: 1.25,
    minWidth: 0,
    gap: spacing.md,
  },
  homeSecondaryColumn: {
    flex: 0.95,
    minWidth: 0,
    gap: spacing.md,
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
    flexShrink: 1,
  },
  homeValueMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '600',
    lineHeight: 16,
  },
  homeSectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    lineHeight: 18,
  },
  homeCategoryTileMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
  },
  homeCategoryCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  homeCategoryCarouselCard: {
    width: 176,
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  homeCategoryCarouselCardAccent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brandRed,
  },
  homeCategoryCarouselTitle: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  homeCategoryCarouselMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    fontWeight: '700',
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
    borderColor: '#F0D5DA',
    backgroundColor: '#FFFFFF',
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
  homeChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
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
  homeFeaturedCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  homeFeaturedCardWrap: {
    width: 208,
  },
  homeFeaturedSectionCard: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  homePromoRibbon: {
    gap: spacing.sm,
  },
  homePromoBadge: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    gap: spacing.xxs,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  homePromoBadgeTitle: {
    color: colors.brandBlack,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  homePromoBadgeMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    lineHeight: 16,
  },
  homeShelfShowcase: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
  },
  homeShelfHeader: {
    gap: spacing.xs,
  },
  homeShelfHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  homeShelfAction: {
    minHeight: 36,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: spacing.sm,
  },
  homeShelfActionText: {
    color: colors.brandBlack,
    fontSize: typography.caption,
    fontWeight: '800',
    includeFontPadding: false,
  },
  homeShelfCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  homeShelfCardWrap: {
    width: 198,
  },
  homeVisualCategoryBand: {
    gap: spacing.sm,
  },
  homeCategoryVisualCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  homeCategoryVisualCard: {
    width: 176,
    minHeight: 140,
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  homeCategoryVisualCardAccent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brandRed,
  },
  homeCategoryVisualTitle: {
    color: colors.brandBlack,
    fontSize: typography.h3,
    fontWeight: '900',
    lineHeight: 22,
  },
  homeCategoryVisualMeta: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  homeProductGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  homeGridCardWrap: {
    width: '48%',
    minWidth: 156,
  },
  homeCompactList: {
    gap: spacing.sm,
  },
  homeCompactListItem: {
    width: '100%',
  },
  homeCompactCarousel: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  homeCompactCarouselCard: {
    width: 194,
  },
  homeCollectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  homeCollectionTile: {
    width: '48%',
    minHeight: 132,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E6EBF3',
    backgroundColor: '#F9FBFE',
    padding: spacing.sm,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  homeCollectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  homeCollectionMeta: {
    color: colors.textSecondary,
    fontSize: typography.micro,
    lineHeight: 16,
  },
  homeCollectionCount: {
    color: colors.brandRed,
    fontSize: typography.micro,
    fontWeight: '800',
  },
  homeMiniPromoCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F0D5DA',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.xs,
  },
  homeMiniPromoTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontWeight: '900',
    lineHeight: 22,
  },

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
    gap: spacing.md,
  },
  sectionHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seeAll: { color: colors.brandRed, fontSize: typography.caption, fontWeight: '800' },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },

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
  totalValueLarge: { color: colors.brandBlack, fontWeight: '900', fontSize: typography.h1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },

  // Cart Screen Styles
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  checkoutSummary: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: { fontSize: typography.h4, color: colors.brandBlack, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  totalInfo: { gap: spacing.xxs },
  totalLabel: { fontSize: typography.body, color: colors.brandBlack, fontWeight: '600' },
  totalSubLabel: { fontSize: typography.caption, color: colors.textSecondary },
  totalValue: { fontSize: typography.h3, color: colors.brandGreen, fontWeight: '900' },
  checkoutButton: {
    backgroundColor: colors.brandGreen,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  checkoutButtonText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '700' },

  // Delivery Address
  deliveryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  deliveryEta: { color: colors.textSecondary, fontSize: typography.caption },
  addressDisplay: { gap: spacing.md },
  addressBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  addressBadgeText: { color: '#065F46', fontSize: typography.caption, fontWeight: '600' },
  addressDetails: { gap: spacing.xxs },
  addressName: { fontSize: typography.body, color: colors.brandBlack, fontWeight: '600' },
  addressContact: { fontSize: typography.caption, color: colors.textSecondary },
  addressLocation: { fontSize: typography.caption, color: colors.textSecondary, lineHeight: 16 },
  changeAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  changeAddressText: { color: colors.brandBlue, fontSize: typography.caption, fontWeight: '600' },

  // Address Form
  addressForm: { gap: spacing.md },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formTitle: { fontSize: typography.body, color: colors.brandAmber, fontWeight: '600' },
  formFields: { gap: spacing.sm },
  addressInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.brandBlack,
  },
  addressInputHalf: { flex: 1 },
  addressRow: { flexDirection: 'row', gap: spacing.sm },
  savedAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#EFF6FF',
    borderRadius: radii.md,
  },
  savedAddressText: { color: colors.brandBlue, fontSize: typography.caption, fontWeight: '600' },

  // Cart Items
  cartItemsSection: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: typography.h4, color: colors.brandBlack, fontWeight: '600' },
  cartItemCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.md,
  },
  productImageContainer: { width: 80, height: 80, borderRadius: radii.md, overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productDetails: { flex: 1, gap: spacing.sm },
  productName: {
    fontSize: typography.body,
    color: colors.brandBlack,
    fontWeight: '600',
    lineHeight: 20,
  },
  productVariant: { fontSize: typography.caption, color: colors.textSecondary },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: typography.body, color: colors.brandBlack, fontWeight: '700' },
  productSubtotal: { fontSize: typography.caption, color: colors.brandGreen, fontWeight: '600' },
  stockWarning: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stockWarningText: { fontSize: typography.caption, color: '#F59E0B' },
  quantityControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  quantityButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.brandBlack,
    minWidth: 40,
    textAlign: 'center',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  removeButtonText: { color: '#EF4444', fontSize: typography.caption, fontWeight: '600' },

  // Redesigned Account Screen Styles
  accountHeaderCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  accountAvatarContainer: { position: 'relative' },
  accountAvatar: {
    width: 80,
    height: 80,
    borderRadius: radii.xl,
    backgroundColor: colors.brandRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: { color: '#FFFFFF', fontSize: typography.h2, fontWeight: '900' },
  editProfileButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  accountProfileInfo: { flex: 1, gap: spacing.xs },
  accountName: { fontSize: typography.h3, color: colors.brandBlack, fontWeight: '700' },
  accountEmail: { fontSize: typography.body, color: colors.textSecondary },
  accountMembershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  accountMembershipText: { fontSize: typography.caption, color: '#B45309', fontWeight: '600' },

  // Account Stats Grid
  accountStatsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  accountStatItem: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  accountStatNumber: { fontSize: typography.h2, color: colors.brandBlack, fontWeight: '900' },
  accountStatLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Quick Actions
  accountQuickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickActionText: { fontSize: typography.caption, color: colors.brandBlack, fontWeight: '600' },

  // Account QR Section
  accountQrSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accountQrContainer: {
    backgroundColor: '#F8F9FB',
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  accountQrPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  accountQrInfo: { flex: 1, gap: spacing.xs },
  accountQrTitle: { fontSize: typography.body, color: colors.brandBlack, fontWeight: '600' },
  accountQrSubtitle: { fontSize: typography.caption, color: colors.textSecondary },
  accountQrAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  accountQrActionText: { fontSize: typography.caption, color: colors.brandBlue, fontWeight: '600' },
  accountQrLoading: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  accountQrLoadingText: { fontSize: typography.caption, color: colors.textSecondary },
  accountQrError: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  accountQrErrorText: { fontSize: typography.caption, color: '#EF4444', textAlign: 'center' },
  accountQrRetryButton: {
    backgroundColor: colors.brandRed,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  accountQrRetryText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '600' },
  accountQrGenerateButton: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  accountQrGenerateText: { fontSize: typography.body, color: colors.brandBlue, fontWeight: '600' },
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
  inlineAddressForm: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  textInputHalf: {
    flex: 1,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.brandBlack,
    backgroundColor: '#FFFFFF',
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

  // Redesigned Loyalty Screen Styles
  loyaltyHeroLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  loyaltyTierBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loyaltyPointsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  loyaltyPointsLabel: { color: '#D1D5DB', fontSize: typography.caption, textAlign: 'center' },
  loyaltyPointsSub: { color: '#9CA3AF', fontSize: typography.caption, textAlign: 'center' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '600' },
  progressValue: { color: colors.brandAmber, fontSize: typography.body, fontWeight: '700' },
  maxTierCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  maxTierText: {
    color: '#FFD700',
    fontSize: typography.h3,
    fontWeight: '700',
    textAlign: 'center',
  },
  maxTierSub: { color: '#D1D5DB', fontSize: typography.caption, textAlign: 'center' },
  voucherCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voucherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  voucherRate: { color: colors.textSecondary, fontSize: typography.caption },
  voucherOptions: { paddingBottom: spacing.sm, gap: spacing.sm },
  voucherOption: {
    backgroundColor: '#F8F9FB',
    borderRadius: radii.lg,
    padding: spacing.md,
    minWidth: 100,
    alignItems: 'center',
    gap: spacing.xs,
  },
  voucherOptionActive: {
    backgroundColor: colors.brandGreen,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  voucherOptionDisabled: { backgroundColor: '#F3F4F6', opacity: 0.6 },
  voucherOptionPoints: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  voucherOptionPointsActive: { color: '#FFFFFF' },
  voucherOptionPointsDisabled: { color: '#9CA3AF' },
  voucherOptionValue: { fontSize: typography.body, color: colors.brandBlack, fontWeight: '700' },
  voucherOptionValueActive: { color: '#FFFFFF' },
  voucherOptionValueDisabled: { color: '#9CA3AF' },
  voucherOptionNote: { fontSize: typography.caption, color: colors.brandAmber },
  activeVoucherCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#10B981',
    borderLeftWidth: 4,
  },
  voucherCode: {
    color: colors.brandBlack,
    fontSize: typography.h3,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  voucherDetails: { gap: spacing.sm, marginTop: spacing.md },
  voucherValueRow: { alignItems: 'center', gap: spacing.xs },
  voucherValue: { color: '#10B981', fontSize: typography.h2, fontWeight: '900' },
  voucherValueLabel: { color: colors.textSecondary, fontSize: typography.caption },
  voucherExpiry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voucherExpiryText: { color: '#EF4444', fontSize: typography.caption },
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  memberSubtext: { color: colors.textSecondary, fontSize: typography.caption },
  qrPlaceholder: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  accountQrLoading: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  accountQrLoadingText: { fontSize: typography.caption, color: colors.textSecondary },

  // Redesigned Cart Screen Styles
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  checkoutSummary: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

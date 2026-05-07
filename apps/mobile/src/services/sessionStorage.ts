import type * as FileSystemLegacy from 'expo-file-system/legacy';

type StoredSession = {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  };
};

type AppPreferences = {
  favoriteCategoryIds: string[];
  continueBrowsingProductIds: string[];
  continueBrowsingCategoryIds: string[];
  filterPresets: Array<{
    id: string;
    name: string;
    brandFilter: string;
    priceFilter: 'toate' | 'sub200' | 'intre200si500' | 'intre500si1000' | 'peste1000';
    onlyDiscount: boolean;
    onlyInStock: boolean;
    sortOption: 'relevanta' | 'pretCrescator' | 'pretDescrescator' | 'numeAZ';
  }>;
  compareProductIds: string[];
  savedCartLists: Array<{
    id: string;
    name: string;
    createdAt: string;
    lines: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      unitPriceRon?: number;
    }>;
  }>;
  guestCart: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    unitPriceRon?: number;
  }>;
  preferenceOnboarding: {
    completed: boolean;
    favoriteBrands: string[];
    favoriteCategories: string[];
    marketingOptIn: boolean;
  };
  trustConsent: {
    analytics: boolean;
    personalization: boolean;
    marketing: boolean;
    updatedAt: string;
  };
  accountSettings: {
    biometricLoginEnabled: boolean;
    biometricPromptShown: boolean;
    marketingEmailsEnabled: boolean;
  };
};

type FileSystemLegacyModule = typeof FileSystemLegacy;

let fileSystemModule: FileSystemLegacyModule | null | undefined;

const getFileSystem = (): FileSystemLegacyModule | null => {
  if (typeof fileSystemModule !== 'undefined') {
    return fileSystemModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fileSystemModule = require('expo-file-system/legacy') as FileSystemLegacyModule;
  } catch (error) {
    console.error(
      '[BOOT][sessionStorage] expo-file-system/legacy failed to load. Falling back to memory-only mode.',
      error,
    );
    fileSystemModule = null;
  }

  return fileSystemModule;
};

const resolveCacheRoot = (): string | null => {
  const fs = getFileSystem();
  if (!fs) return null;

  try {
    const root = fs.documentDirectory ?? fs.cacheDirectory ?? null;
    if (!root) {
      console.warn(
        '[BOOT][sessionStorage] Cache root unavailable. Falling back to in-memory session/preferences storage.',
      );
    }
    return root;
  } catch {
    console.error(
      '[BOOT][sessionStorage] Failed to resolve cache root from expo-file-system. Falling back to memory-only mode.',
    );
    return null;
  }
};

const cacheRoot = resolveCacheRoot();
const SESSION_FILE = cacheRoot ? `${cacheRoot}auth-session-v1.json` : null;
const PREFERENCES_FILE = cacheRoot ? `${cacheRoot}app-preferences-v1.json` : null;

let memorySession: StoredSession | null = null;
let memoryPreferences: AppPreferences | null = null;

const defaultPreferences = (): AppPreferences => ({
  favoriteCategoryIds: [],
  continueBrowsingProductIds: [],
  continueBrowsingCategoryIds: [],
  filterPresets: [],
  compareProductIds: [],
  savedCartLists: [],
  guestCart: [],
  preferenceOnboarding: {
    completed: false,
    favoriteBrands: [],
    favoriteCategories: [],
    marketingOptIn: false,
  },
  trustConsent: {
    analytics: true,
    personalization: true,
    marketing: false,
    updatedAt: new Date(0).toISOString(),
  },
  accountSettings: {
    biometricLoginEnabled: false,
    biometricPromptShown: false,
    marketingEmailsEnabled: false,
  },
});

const normalizePreferences = (value: unknown): AppPreferences => {
  const fallback = defaultPreferences();
  if (!value || typeof value !== 'object') return fallback;
  const parsed = value as Partial<AppPreferences>;

  return {
    favoriteCategoryIds: Array.isArray(parsed.favoriteCategoryIds)
      ? parsed.favoriteCategoryIds.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        )
      : fallback.favoriteCategoryIds,
    continueBrowsingProductIds: Array.isArray(parsed.continueBrowsingProductIds)
      ? parsed.continueBrowsingProductIds.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        )
      : fallback.continueBrowsingProductIds,
    continueBrowsingCategoryIds: Array.isArray(parsed.continueBrowsingCategoryIds)
      ? parsed.continueBrowsingCategoryIds.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        )
      : fallback.continueBrowsingCategoryIds,
    filterPresets: Array.isArray(parsed.filterPresets)
      ? parsed.filterPresets.filter(
          (item): item is AppPreferences['filterPresets'][number] =>
            !!item && typeof item === 'object',
        )
      : fallback.filterPresets,
    compareProductIds: Array.isArray(parsed.compareProductIds)
      ? parsed.compareProductIds.filter(
          (item): item is string => typeof item === 'string' && item.length > 0,
        )
      : fallback.compareProductIds,
    savedCartLists: Array.isArray(parsed.savedCartLists)
      ? parsed.savedCartLists.filter(
          (item): item is AppPreferences['savedCartLists'][number] =>
            !!item && typeof item === 'object',
        )
      : fallback.savedCartLists,
    guestCart: Array.isArray(parsed.guestCart)
      ? parsed.guestCart.filter(
          (item): item is AppPreferences['guestCart'][number] =>
            !!item && typeof item === 'object' && typeof item.productId === 'string',
        )
      : fallback.guestCart,
    preferenceOnboarding:
      parsed.preferenceOnboarding && typeof parsed.preferenceOnboarding === 'object'
        ? {
            completed: !!parsed.preferenceOnboarding.completed,
            favoriteBrands: Array.isArray(parsed.preferenceOnboarding.favoriteBrands)
              ? parsed.preferenceOnboarding.favoriteBrands.filter(
                  (item): item is string => typeof item === 'string' && item.length > 0,
                )
              : [],
            favoriteCategories: Array.isArray(parsed.preferenceOnboarding.favoriteCategories)
              ? parsed.preferenceOnboarding.favoriteCategories.filter(
                  (item): item is string => typeof item === 'string' && item.length > 0,
                )
              : [],
            marketingOptIn: !!parsed.preferenceOnboarding.marketingOptIn,
          }
        : fallback.preferenceOnboarding,
    trustConsent:
      parsed.trustConsent && typeof parsed.trustConsent === 'object'
        ? {
            analytics:
              typeof parsed.trustConsent.analytics === 'boolean'
                ? parsed.trustConsent.analytics
                : fallback.trustConsent.analytics,
            personalization:
              typeof parsed.trustConsent.personalization === 'boolean'
                ? parsed.trustConsent.personalization
                : fallback.trustConsent.personalization,
            marketing:
              typeof parsed.trustConsent.marketing === 'boolean'
                ? parsed.trustConsent.marketing
                : fallback.trustConsent.marketing,
            updatedAt:
              typeof parsed.trustConsent.updatedAt === 'string' &&
              parsed.trustConsent.updatedAt.length > 0
                ? parsed.trustConsent.updatedAt
                : fallback.trustConsent.updatedAt,
          }
        : fallback.trustConsent,
    accountSettings:
      parsed.accountSettings && typeof parsed.accountSettings === 'object'
        ? {
            biometricLoginEnabled:
              typeof parsed.accountSettings.biometricLoginEnabled === 'boolean'
                ? parsed.accountSettings.biometricLoginEnabled
                : fallback.accountSettings.biometricLoginEnabled,
            biometricPromptShown:
              typeof parsed.accountSettings.biometricPromptShown === 'boolean'
                ? parsed.accountSettings.biometricPromptShown
                : fallback.accountSettings.biometricPromptShown,
            marketingEmailsEnabled:
              typeof parsed.accountSettings.marketingEmailsEnabled === 'boolean'
                ? parsed.accountSettings.marketingEmailsEnabled
                : !!parsed.preferenceOnboarding?.marketingOptIn,
          }
        : {
            ...fallback.accountSettings,
            marketingEmailsEnabled: !!parsed.preferenceOnboarding?.marketingOptIn,
          },
  };
};

export const getStoredSession = async (): Promise<StoredSession | null> => {
  if (memorySession) return memorySession;
  if (!SESSION_FILE) return null;

  const fs = getFileSystem();
  if (!fs) return null;

  try {
    const info = await fs.getInfoAsync(SESSION_FILE);
    if (!info.exists) return null;
    const raw = await fs.readAsStringAsync(SESSION_FILE);
    const parsed = JSON.parse(raw) as StoredSession;

    if (!parsed.sessionToken || !parsed.user?.id) return null;
    memorySession = parsed;
    return parsed;
  } catch {
    return null;
  }
};

export const setStoredSession = async (session: StoredSession): Promise<void> => {
  memorySession = session;
  if (!SESSION_FILE) return;

  const fs = getFileSystem();
  if (!fs) return;

  try {
    await fs.writeAsStringAsync(SESSION_FILE, JSON.stringify(session));
  } catch {
    // best-effort only
  }
};

export const clearStoredSession = async (): Promise<void> => {
  memorySession = null;
  if (!SESSION_FILE) return;

  const fs = getFileSystem();
  if (!fs) return;

  try {
    const info = await fs.getInfoAsync(SESSION_FILE);
    if (info.exists) {
      await fs.deleteAsync(SESSION_FILE);
    }
  } catch {
    // best-effort only
  }
};

export const getSessionToken = async (): Promise<string | null> => {
  const session = await getStoredSession();
  return session?.sessionToken ?? null;
};

export const getAppPreferences = async (): Promise<AppPreferences> => {
  if (memoryPreferences) return memoryPreferences;
  if (!PREFERENCES_FILE) {
    memoryPreferences = defaultPreferences();
    return memoryPreferences;
  }

  const fs = getFileSystem();
  if (!fs) {
    memoryPreferences = defaultPreferences();
    return memoryPreferences;
  }

  try {
    const info = await fs.getInfoAsync(PREFERENCES_FILE);
    if (!info.exists) {
      memoryPreferences = defaultPreferences();
      return memoryPreferences;
    }

    const raw = await fs.readAsStringAsync(PREFERENCES_FILE);
    const parsed = JSON.parse(raw) as unknown;
    memoryPreferences = normalizePreferences(parsed);
    return memoryPreferences;
  } catch {
    memoryPreferences = defaultPreferences();
    return memoryPreferences;
  }
};

export const setAppPreferences = async (next: AppPreferences): Promise<void> => {
  const normalized = normalizePreferences(next);
  memoryPreferences = normalized;
  if (!PREFERENCES_FILE) return;

  const fs = getFileSystem();
  if (!fs) return;

  try {
    await fs.writeAsStringAsync(PREFERENCES_FILE, JSON.stringify(normalized));
  } catch {
    // best-effort only
  }
};

export const updateAppPreferences = async (
  updater: (current: AppPreferences) => AppPreferences,
): Promise<AppPreferences> => {
  const current = await getAppPreferences();
  const next = normalizePreferences(updater(current));
  await setAppPreferences(next);
  return next;
};

export const getGuestCart = async (): Promise<AppPreferences['guestCart']> => {
  const prefs = await getAppPreferences();
  return prefs.guestCart ?? [];
};

export const updateGuestCart = async (
  cart: AppPreferences['guestCart'],
): Promise<void> => {
  await updateAppPreferences((current) => ({
    ...current,
    guestCart: cart,
  }));
};

export type { StoredSession };
export type { AppPreferences };

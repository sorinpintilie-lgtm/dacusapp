import type * as FileSystemLegacy from 'expo-file-system/legacy';

import type { LiveCatalogCategory, LiveCatalogPayload, LiveCatalogProduct } from './storefront';

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
      '[BOOT][catalogCache] expo-file-system/legacy failed to load. Catalog cache disabled.',
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
      console.warn('[BOOT][catalogCache] Cache root unavailable. Catalog cache will be disabled.');
    }
    return root;
  } catch {
    console.error(
      '[BOOT][catalogCache] Failed to resolve cache root from expo-file-system. Catalog cache disabled.',
    );
    return null;
  }
};

const cacheRoot = resolveCacheRoot();
const CATALOG_CACHE_FILE = cacheRoot ? `${cacheRoot}catalog-cache-v1.json` : null;

export type CatalogCacheEntry = {
  payload: LiveCatalogPayload;
  cachedAt: number;
  stamp: string | null;
};

type CatalogCacheRecordV2 = {
  version: 2;
  cachedAt: number;
  stamp: string | null;
  payload: LiveCatalogPayload;
};

const normalizeCategory = (value: unknown, index: number): LiveCatalogCategory | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<LiveCatalogCategory>;
  const id =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id.trim() : '';
  if (!id) return null;

  const name =
    typeof candidate.name === 'string' && candidate.name.trim().length > 0
      ? candidate.name.trim()
      : `Categorie ${index + 1}`;
  const description = typeof candidate.description === 'string' ? candidate.description : '';
  const imageUrl =
    typeof candidate.imageUrl === 'string' && candidate.imageUrl.length > 0
      ? candidate.imageUrl
      : undefined;

  return {
    id,
    name,
    description,
    ...(imageUrl ? { imageUrl } : {}),
  };
};

const normalizeProduct = (
  value: unknown,
  fallbackCategoryId: string,
): LiveCatalogProduct | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<LiveCatalogProduct>;
  const id =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id.trim() : '';
  if (!id) return null;

  const categoryId =
    typeof candidate.categoryId === 'string' && candidate.categoryId.trim().length > 0
      ? candidate.categoryId.trim()
      : fallbackCategoryId;
  const name =
    typeof candidate.name === 'string' && candidate.name.trim().length > 0
      ? candidate.name.trim()
      : 'Produs';
  const brand =
    typeof candidate.brand === 'string' && candidate.brand.trim().length > 0
      ? candidate.brand.trim()
      : 'Dacus';
  const stockLabel =
    typeof candidate.stockLabel === 'string' && candidate.stockLabel.trim().length > 0
      ? candidate.stockLabel.trim()
      : 'În stoc';
  const priceRon =
    typeof candidate.priceRon === 'number' && Number.isFinite(candidate.priceRon)
      ? Number(candidate.priceRon)
      : 0;

  const imageUrl =
    typeof candidate.imageUrl === 'string' && candidate.imageUrl.length > 0
      ? candidate.imageUrl
      : undefined;
  const thumbnailUrl =
    typeof candidate.thumbnailUrl === 'string' && candidate.thumbnailUrl.length > 0
      ? candidate.thumbnailUrl
      : undefined;
  const description = typeof candidate.description === 'string' ? candidate.description : undefined;
  const oldPriceRon =
    typeof candidate.oldPriceRon === 'number' && Number.isFinite(candidate.oldPriceRon)
      ? Number(candidate.oldPriceRon)
      : undefined;
  const handle =
    typeof candidate.handle === 'string' && candidate.handle.length > 0
      ? candidate.handle
      : undefined;
  const sku =
    typeof candidate.sku === 'string' && candidate.sku.length > 0 ? candidate.sku : undefined;
  const variantId =
    typeof candidate.variantId === 'string' && candidate.variantId.length > 0
      ? candidate.variantId
      : undefined;
  const categoryIds = Array.isArray(candidate.categoryIds)
    ? candidate.categoryIds.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      )
    : undefined;
  const variants = Array.isArray(candidate.variants)
    ? candidate.variants
        .map((variant) => {
          if (!variant || typeof variant !== 'object') return null;
          const item = variant as {
            id?: unknown;
            name?: unknown;
            priceRon?: unknown;
            inStock?: unknown;
          };
          if (typeof item.id !== 'string' || item.id.length === 0) return null;
          if (typeof item.name !== 'string' || item.name.length === 0) return null;
          if (typeof item.priceRon !== 'number' || !Number.isFinite(item.priceRon)) return null;
          return {
            id: item.id,
            name: item.name,
            priceRon: item.priceRon,
            inStock: Boolean(item.inStock),
          };
        })
        .filter((item): item is NonNullable<typeof item> => !!item)
    : undefined;

  return {
    id,
    categoryId,
    name,
    brand,
    stockLabel,
    priceRon,
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(typeof oldPriceRon === 'number' ? { oldPriceRon } : {}),
    ...(handle ? { handle } : {}),
    ...(sku ? { sku } : {}),
    ...(variantId ? { variantId } : {}),
    ...(categoryIds && categoryIds.length > 0 ? { categoryIds } : {}),
    ...(variants && variants.length > 0 ? { variants } : {}),
  };
};

const normalizeCatalogPayload = (payload: LiveCatalogPayload): LiveCatalogPayload => {
  const categories = payload.categories
    .map((item, index) => normalizeCategory(item, index))
    .filter((item): item is LiveCatalogCategory => !!item);
  const fallbackCategoryId = categories[0]?.id ?? 'uncategorized';

  const products = payload.products
    .map((item) => normalizeProduct(item, fallbackCategoryId))
    .filter((item): item is LiveCatalogProduct => !!item);

  return {
    categories,
    products,
    hasMoreProducts: !!payload.hasMoreProducts,
    productsCursor: payload.productsCursor ?? null,
  };
};

const isValidCatalogPayload = (value: unknown): value is LiveCatalogPayload => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<LiveCatalogPayload>;
  return (
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.products) &&
    typeof candidate.hasMoreProducts === 'boolean' &&
    (typeof candidate.productsCursor === 'string' || candidate.productsCursor === null)
  );
};

const isValidCatalogCacheRecordV2 = (value: unknown): value is CatalogCacheRecordV2 => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<CatalogCacheRecordV2>;
  return (
    candidate.version === 2 &&
    typeof candidate.cachedAt === 'number' &&
    Number.isFinite(candidate.cachedAt) &&
    (typeof candidate.stamp === 'string' ||
      candidate.stamp === null ||
      typeof candidate.stamp === 'undefined') &&
    isValidCatalogPayload(candidate.payload)
  );
};

export const readCatalogCacheEntry = async (): Promise<CatalogCacheEntry | null> => {
  if (!CATALOG_CACHE_FILE) return null;

  const fs = getFileSystem();
  if (!fs) return null;

  try {
    const fileInfo = await fs.getInfoAsync(CATALOG_CACHE_FILE);
    if (!fileInfo.exists) return null;

    const raw = await fs.readAsStringAsync(CATALOG_CACHE_FILE);
    const parsed = JSON.parse(raw) as unknown;

    if (isValidCatalogCacheRecordV2(parsed)) {
      const normalizedPayload = normalizeCatalogPayload(parsed.payload);
      return {
        payload: normalizedPayload,
        cachedAt: parsed.cachedAt,
        stamp: parsed.stamp ?? null,
      };
    }

    if (isValidCatalogPayload(parsed)) {
      // backward compatibility with old cache format
      const normalizedPayload = normalizeCatalogPayload(parsed);
      return {
        payload: normalizedPayload,
        cachedAt: 0,
        stamp: null,
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const readCatalogCache = async (): Promise<LiveCatalogPayload | null> => {
  const entry = await readCatalogCacheEntry();
  return entry?.payload ?? null;
};

export const writeCatalogCache = async (
  payload: LiveCatalogPayload,
  options?: { stamp?: string | null; cachedAt?: number },
): Promise<void> => {
  if (!CATALOG_CACHE_FILE) return;

  const fs = getFileSystem();
  if (!fs) return;

  try {
    const normalizedPayload = normalizeCatalogPayload(payload);
    const record: CatalogCacheRecordV2 = {
      version: 2,
      cachedAt: options?.cachedAt ?? Date.now(),
      stamp: options?.stamp ?? null,
      payload: normalizedPayload,
    };

    await fs.writeAsStringAsync(CATALOG_CACHE_FILE, JSON.stringify(record));
  } catch {
    // no-op: cache write failures should never break app startup
  }
};

import { mobileEnv } from '../config/env';
import { getCatalog as getCatalogFromFn } from './functionsClient';

type CatalogApiPayload = {
  categories: LiveCatalogCategory[];
  products: LiveCatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
  source?: 'live' | 'cache';
  generatedAt?: string;
};

export type LiveCatalogProduct = {
  id: string;
  categoryId: string;
  categoryIds?: string[];
  handle?: string;
  sku?: string;
  variantId?: string;
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
  variants?: Array<{
    id: string;
    name: string;
    priceRon: number;
    inStock: boolean;
  }>;
};

export type LiveCatalogCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

export type LiveCatalogPayload = {
  categories: LiveCatalogCategory[];
  products: LiveCatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
};

export type CatalogStampPayload = {
  stamp: string;
};

type LoadCatalogOptions = {
  startAfterCursor?: string | null;
  pageSize?: number;
  leanQuery?: boolean;
  includeCategories?: boolean;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

const isLikelyLocalApiBaseUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const isRetriableError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('abort') ||
    message.includes('status 429') ||
    message.includes('status 5')
  );
};

const fetchWithRetry = async (requestFactory: () => Promise<Response>): Promise<Response> => {
  const maxRetries = mobileEnv.storefrontRetryCount;
  let attempt = 0;

  while (true) {
    try {
      return await requestFactory();
    } catch (error) {
      if (attempt >= maxRetries || !isRetriableError(error)) {
        throw error;
      }

      attempt += 1;
      await sleep(300 * attempt);
    }
  }
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

const normalizePayload = (payload: CatalogApiPayload): LiveCatalogPayload => ({
  categories: (Array.isArray(payload.categories) ? payload.categories : [])
    .map((item, index) => normalizeCategory(item, index))
    .filter((item): item is LiveCatalogCategory => !!item),
  products: (() => {
    const normalizedCategories = (Array.isArray(payload.categories) ? payload.categories : [])
      .map((item, index) => normalizeCategory(item, index))
      .filter((item): item is LiveCatalogCategory => !!item);
    const fallbackCategoryId = normalizedCategories[0]?.id ?? 'uncategorized';
    const normalizedProducts = (Array.isArray(payload.products) ? payload.products : [])
      .map((item) => normalizeProduct(item, fallbackCategoryId))
      .filter((item): item is LiveCatalogProduct => !!item);
    return Array.from(new Map(normalizedProducts.map((product) => [product.id, product])).values());
  })(),
  hasMoreProducts: !!payload.hasMoreProducts,
  productsCursor: payload.productsCursor ?? null,
});

const loadFromApi = async (options?: LoadCatalogOptions): Promise<LiveCatalogPayload> => {
  const baseUrl = mobileEnv.apiBaseUrl.endsWith('/')
    ? mobileEnv.apiBaseUrl
    : `${mobileEnv.apiBaseUrl}/`;
  const url = new URL('catalog', baseUrl);

  if (options?.startAfterCursor) {
    url.searchParams.set('after', options.startAfterCursor);
  }

  if (typeof options?.pageSize === 'number' && Number.isFinite(options.pageSize)) {
    url.searchParams.set('pageSize', `${Math.max(10, Math.trunc(options.pageSize))}`);
  }

  if (options?.leanQuery === false) {
    url.searchParams.set('lean', '0');
  }

  if (options?.includeCategories === false) {
    url.searchParams.set('includeCategories', '0');
  }

  const response = await fetchWithRetry(() =>
    (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), mobileEnv.storefrontTimeoutMs);

      try {
        const requestResponse = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
        });

        if (!requestResponse.ok) {
          throw new Error(`Catalog API request failed with status ${requestResponse.status}`);
        }

        return requestResponse;
      } finally {
        clearTimeout(timeout);
      }
    })(),
  );

  const payload = (await response.json()) as CatalogApiPayload;
  return normalizePayload(payload);
};

export const loadLiveCatalog = async (
  options?: LoadCatalogOptions,
): Promise<LiveCatalogPayload> => {
  try {
    const result = await getCatalogFromFn(undefined, options?.pageSize || 250);
    return {
      categories: result.categories as LiveCatalogCategory[],
      products: result.products as LiveCatalogProduct[],
      hasMoreProducts: result.hasMoreProducts,
      productsCursor: result.productsCursor,
    };
  } catch {
    return loadFromApi({
      includeCategories: options?.includeCategories ?? true,
      pageSize: options?.pageSize,
      startAfterCursor: options?.startAfterCursor,
      leanQuery: options?.leanQuery ?? true,
    });
  }
};

export const loadCatalogStamp = async (): Promise<CatalogStampPayload | null> => {
  try {
    const result = await getCatalogFromFn(undefined, 1);
    return { stamp: result.stamp ?? 'updated' };
  } catch {
    // fallback to REST API below
  }

  if (isLikelyLocalApiBaseUrl(mobileEnv.apiBaseUrl)) return null;

  const baseUrl = mobileEnv.apiBaseUrl.endsWith('/')
    ? mobileEnv.apiBaseUrl
    : `${mobileEnv.apiBaseUrl}/`;
  const url = new URL('catalog/stamp', baseUrl);

  try {
    const response = await fetchWithRetry(() =>
      (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          Math.max(3500, Math.trunc(mobileEnv.storefrontTimeoutMs * 0.6)),
        );

        try {
          const requestResponse = await fetch(url.toString(), {
            method: 'GET',
            signal: controller.signal,
          });

          if (!requestResponse.ok) {
            throw new Error(`Catalog stamp request failed with status ${requestResponse.status}`);
          }

          return requestResponse;
        } finally {
          clearTimeout(timeout);
        }
      })(),
    );

    const payload = (await response.json()) as { stamp?: string };
    if (typeof payload.stamp !== 'string' || payload.stamp.length === 0) return null;

    return { stamp: payload.stamp };
  } catch {
    try {
      const result = await getCatalogFromFn(undefined, 1);
      return { stamp: result.stamp ?? 'updated' };
    } catch {
      return null;
    }
  }
};

export const loadLiveCatalogProductsAfterCursor = async (
  startAfterCursor: string | null,
  options?: { pageSize?: number; leanQuery?: boolean },
): Promise<LiveCatalogProduct[]> => {
  if (!startAfterCursor) return [];
  const payload = await loadFromApi({
    startAfterCursor,
    pageSize: options?.pageSize,
    leanQuery: options?.leanQuery ?? true,
    includeCategories: false,
  });

  return payload.products;
};

export const streamLiveCatalogProductsAfterCursor = async (
  startAfterCursor: string | null,
  onPage: (products: LiveCatalogProduct[], loadedTotal: number) => void,
  options?: { pageSize?: number; leanQuery?: boolean },
): Promise<number> => {
  if (!startAfterCursor) return 0;

  let cursor: string | null = startAfterCursor;
  let loadedTotal = 0;

  while (cursor) {
    const payload = await loadFromApi({
      startAfterCursor: cursor,
      pageSize: options?.pageSize,
      leanQuery: options?.leanQuery ?? true,
      includeCategories: false,
    });

    if (payload.products.length === 0) break;

    loadedTotal += payload.products.length;
    onPage(payload.products, loadedTotal);

    if (!payload.hasMoreProducts || !payload.productsCursor) break;
    cursor = payload.productsCursor;
  }

  return loadedTotal;
};

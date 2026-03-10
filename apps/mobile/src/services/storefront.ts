import { mobileEnv } from '../config/env';

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
  handle?: string;
  sku?: string;
  name: string;
  brand: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  priceRon: number;
  oldPriceRon?: number;
  stockLabel: string;
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

type LoadCatalogOptions = {
  startAfterCursor?: string | null;
  pageSize?: number;
  leanQuery?: boolean;
  includeCategories?: boolean;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

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

const normalizePayload = (payload: CatalogApiPayload): LiveCatalogPayload => ({
  categories: Array.isArray(payload.categories) ? payload.categories : [],
  products: Array.isArray(payload.products)
    ? Array.from(new Map(payload.products.map((product) => [product.id, product])).values())
    : [],
  hasMoreProducts: !!payload.hasMoreProducts,
  productsCursor: payload.productsCursor ?? null,
});

const loadFromApi = async (options?: LoadCatalogOptions): Promise<LiveCatalogPayload> => {
  const baseUrl = mobileEnv.apiBaseUrl.endsWith('/') ? mobileEnv.apiBaseUrl : `${mobileEnv.apiBaseUrl}/`;
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

export const loadLiveCatalog = async (options?: LoadCatalogOptions): Promise<LiveCatalogPayload> => {
  return loadFromApi({
    includeCategories: options?.includeCategories ?? true,
    pageSize: options?.pageSize,
    startAfterCursor: options?.startAfterCursor,
    leanQuery: options?.leanQuery ?? true,
  });
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


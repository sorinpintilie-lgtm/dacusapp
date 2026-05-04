import { mobileEnv } from '../config/env';
import { getCatalog as getCatalogFromFn, getCatalogStamp as getCatalogStampFromFn } from './functionsClient';

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

type StorefrontConnectionPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

type StorefrontCollectionNode = {
  id: string;
  title: string;
  description: string;
  image?: { url: string } | null;
};

type StorefrontProductNode = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType?: string;
  description: string;
  availableForSale: boolean;
  featuredImage?: {
    thumbnailUrl: string;
    imageUrl: string;
  } | null;
  collections: {
    edges: Array<{ node: { id: string } }>;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        sku?: string | null;
        availableForSale: boolean;
        price: { amount: string; currencyCode: string };
        compareAtPrice?: { amount: string; currencyCode: string } | null;
      };
    }>;
  };
};

type StorefrontCollectionsResult = {
  collections: {
    pageInfo: StorefrontConnectionPageInfo;
    edges: Array<{ node: StorefrontCollectionNode }>;
  };
};

type StorefrontProductsResult = {
  products: {
    pageInfo: StorefrontConnectionPageInfo;
    edges: Array<{ node: StorefrontProductNode }>;
  };
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

const STOREFRONT_COLLECTIONS_QUERY = `
  query MobileCatalogCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          image {
            url
          }
        }
      }
    }
  }
`;

const STOREFRONT_PRODUCTS_QUERY = `
  query MobileCatalogProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: ID) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          description
          availableForSale
          featuredImage {
            thumbnailUrl: url(transform: { maxWidth: 420, maxHeight: 420, crop: CENTER })
            imageUrl: url(transform: { maxWidth: 960, maxHeight: 960, crop: CENTER })
          }
          collections(first: 20) {
            edges {
              node {
                id
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

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

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

const queryStorefrontDirect = async <T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  if (!mobileEnv.shopifyStoreDomain || !mobileEnv.storefrontPublicToken) {
    throw new Error('Lipsește tokenul public Shopify pentru catalog guest.');
  }

  const endpoint = `https://${mobileEnv.shopifyStoreDomain}/api/2024-10/graphql.json`;
  const response = await fetchWithRetry(() =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': mobileEnv.storefrontPublicToken,
      },
      body: JSON.stringify({ query, variables }),
    }),
  );

  if (!response.ok) {
    throw new Error(`Shopify Storefront request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('Shopify Storefront nu a returnat date.');
  }

  return payload.data;
};

const loadFromStorefrontDirect = async (options?: LoadCatalogOptions): Promise<LiveCatalogPayload> => {
  const pageSize = Math.min(250, Math.max(10, Math.trunc(options?.pageSize ?? 120)));
  const categoriesData = await queryStorefrontDirect<StorefrontCollectionsResult>(
    STOREFRONT_COLLECTIONS_QUERY,
    {
      first: 250,
      after: null,
    },
  );

  const categories = categoriesData.collections.edges.map(({ node }) => ({
    id: node.id,
    name: node.title,
    description: node.description || 'Categorie produse Dacus',
    ...(node.image?.url ? { imageUrl: node.image.url } : {}),
  }));

  const productsData = await queryStorefrontDirect<StorefrontProductsResult>(
    STOREFRONT_PRODUCTS_QUERY,
    {
      first: pageSize,
      after: options?.startAfterCursor ?? null,
    },
  );

  const categoryIds = new Set(categories.map((item) => item.id));
  const products = productsData.products.edges.map(({ node }) => {
    const collectionIds = Array.from(
      new Set(
        node.collections.edges
          .map((edge) => edge.node.id)
          .filter((value) => typeof value === 'string' && value.length > 0),
      ).values(),
    );
    const matchedCollectionIds = collectionIds.filter((collectionId) => categoryIds.has(collectionId));
    let resolvedCategoryId = matchedCollectionIds[0] ?? null;
    let resolvedCategoryIds = matchedCollectionIds;

    if (!resolvedCategoryId) {
      const productType = node.productType?.trim();
      if (productType) {
        const typeCategoryId = `product-type-${toSlug(productType) || 'diverse'}`;
        resolvedCategoryId = typeCategoryId;
        resolvedCategoryIds = [typeCategoryId];
      }
    }

    if (!resolvedCategoryId) {
      resolvedCategoryIds = ['uncategorized'];
    }

    const firstVariant = node.variants.edges[0]?.node;
    const priceRon = Number(firstVariant?.price.amount ?? 0);
    const oldPrice = firstVariant?.compareAtPrice?.amount;
    const oldPriceRon = oldPrice ? Number(oldPrice) : undefined;
    const inStock = firstVariant?.availableForSale ?? node.availableForSale;

    return {
      id: node.id,
      categoryId: resolvedCategoryId ?? 'uncategorized',
      ...(resolvedCategoryIds.length > 0 ? { categoryIds: resolvedCategoryIds } : {}),
      ...(node.handle ? { handle: node.handle } : {}),
      ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
      ...(firstVariant?.id ? { variantId: firstVariant.id } : {}),
      name: node.title,
      brand: node.vendor || 'Dacus',
      ...(node.description ? { description: node.description } : {}),
      ...(node.featuredImage?.thumbnailUrl ? { thumbnailUrl: node.featuredImage.thumbnailUrl } : {}),
      ...(node.featuredImage?.imageUrl
        ? { imageUrl: node.featuredImage.imageUrl }
        : node.featuredImage?.thumbnailUrl
          ? { imageUrl: node.featuredImage.thumbnailUrl }
          : {}),
      priceRon,
      ...(typeof oldPriceRon === 'number' ? { oldPriceRon } : {}),
      stockLabel: inStock ? 'În stoc' : 'Indisponibil',
      ...(firstVariant?.id
        ? {
            variants: [
              {
                id: firstVariant.id,
                name: firstVariant.title || 'Varianta standard',
                priceRon,
                inStock,
              },
            ],
          }
        : {}),
    } satisfies LiveCatalogProduct;
  });

  return {
    categories,
    products,
    hasMoreProducts: productsData.products.pageInfo.hasNextPage,
    productsCursor: productsData.products.pageInfo.endCursor,
  };
};

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
  const after = options?.startAfterCursor ?? undefined;

  try {
    const result = await getCatalogFromFn(after, options?.pageSize || 250);
    const normalizedFromCallable: LiveCatalogPayload = {
      categories: result.categories as LiveCatalogCategory[],
      products: result.products as LiveCatalogProduct[],
      hasMoreProducts: result.hasMoreProducts,
      productsCursor: result.productsCursor,
    };

    const shouldBypassEmptyCallableCache =
      !after &&
      normalizedFromCallable.products.length === 0 &&
      normalizedFromCallable.categories.length === 0;

    if (!shouldBypassEmptyCallableCache) {
      return normalizedFromCallable;
    }
  } catch (callableError) {
    try {
      return await loadFromApi({
        includeCategories: options?.includeCategories ?? true,
        pageSize: options?.pageSize,
        startAfterCursor: options?.startAfterCursor,
        leanQuery: options?.leanQuery ?? true,
      });
    } catch (apiError) {
      try {
        return await loadFromStorefrontDirect(options);
      } catch (storefrontError) {
        throw new Error(
          `callable=${callableError instanceof Error ? callableError.message : String(callableError)}; api=${apiError instanceof Error ? apiError.message : String(apiError)}; storefront=${storefrontError instanceof Error ? storefrontError.message : String(storefrontError)}`,
        );
      }
    }
  }

  try {
    return await loadFromStorefrontDirect(options);
  } catch (storefrontError) {
    try {
      return await loadFromApi({
        includeCategories: options?.includeCategories ?? true,
        pageSize: options?.pageSize,
        startAfterCursor: options?.startAfterCursor,
        leanQuery: options?.leanQuery ?? true,
      });
    } catch (apiError) {
      throw new Error(
        `callable=empty-cache; storefront=${storefrontError instanceof Error ? storefrontError.message : String(storefrontError)}; api=${apiError instanceof Error ? apiError.message : String(apiError)}`,
      );
    }
  }
};

export const loadCatalogStamp = async (): Promise<CatalogStampPayload | null> => {
  try {
    const result = await getCatalogStampFromFn();
    return { stamp: result.stamp };
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

import type { FastifyPluginAsync } from 'fastify';
import type { CatalogStore } from '../services/catalogStore.js';

type CatalogRoutesOptions = {
  catalogEnv: {
    shopifyStoreDomain: string;
    storefrontToken: string;
    cacheTtlMs: number;
  };
  catalogStore: CatalogStore;
};

type GraphQLError = {
  message: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLError[];
};

type ConnectionPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

type StorefrontCollectionNode = {
  id: string;
  title: string;
  description: string;
  image?: {
    url: string;
  } | null;
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
    edges: Array<{
      node: {
        id: string;
      };
    }>;
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

type CatalogCollectionsResult = {
  collections: {
    pageInfo: ConnectionPageInfo;
    edges: Array<{ node: StorefrontCollectionNode }>;
  };
};

type CatalogProductsResult = {
  products: {
    pageInfo: ConnectionPageInfo;
    edges: Array<{ node: StorefrontProductNode }>;
  };
};

type CatalogProductsStampResult = {
  products: {
    edges: Array<{
      node: {
        id: string;
        updatedAt: string;
      };
    }>;
  };
};

type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

type CatalogProduct = {
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

type CatalogApiPayload = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
  source: 'live' | 'cache';
  generatedAt: string;
};

type CatalogStampApiPayload = {
  stamp: string;
  source: 'live' | 'cache';
  generatedAt: string;
};

const CATALOG_COLLECTIONS_QUERY = `
  query DacusCatalogCollections($first: Int!, $after: String) {
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

const CATALOG_PRODUCTS_QUERY = `
  query DacusCatalogProducts($first: Int!, $after: String) {
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

const CATALOG_PRODUCTS_STAMP_QUERY = `
  query DacusCatalogProductsStamp($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          updatedAt
        }
      }
    }
  }
`;

const PAGE_SIZE_MAX = 250;
const PAGE_SIZE_DEFAULT = 60;

type CachedValue = {
  expiresAt: number;
  payload: CatalogApiPayload;
};

const pageCache = new Map<string, CachedValue>();

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const nowIso = () => new Date().toISOString();

const getCachedPayload = (
  store: Map<string, CachedValue>,
  key: string,
): CatalogApiPayload | null => {
  const cached = store.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return {
    ...cached.payload,
    source: 'cache',
  };
};

const setCachedPayload = (
  store: Map<string, CachedValue>,
  key: string,
  ttlMs: number,
  payload: CatalogApiPayload,
) => {
  store.set(key, {
    expiresAt: Date.now() + ttlMs,
    payload,
  });
};

const queryStorefront = async <T>(
  env: CatalogRoutesOptions['catalogEnv'],
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const endpoint = `https://${env.shopifyStoreDomain}/api/2024-10/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Storefront request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('No Storefront data returned');
  }

  return payload.data;
};

const loadAllCollections = async (
  env: CatalogRoutesOptions['catalogEnv'],
): Promise<CatalogCategory[]> => {
  const categories: CatalogCategory[] = [];
  let cursor: string | null = null;

  while (true) {
    const collectionPage: CatalogCollectionsResult =
      await queryStorefront<CatalogCollectionsResult>(env, CATALOG_COLLECTIONS_QUERY, {
        first: PAGE_SIZE_MAX,
        after: cursor,
      });

    const mapped = collectionPage.collections.edges.map(
      ({ node }: { node: StorefrontCollectionNode }) => ({
        id: node.id,
        name: node.title,
        description: node.description || 'Categorie produse Dacus',
        ...(node.image?.url ? { imageUrl: node.image.url } : {}),
      }),
    );

    categories.push(...mapped);

    const pageInfo: ConnectionPageInfo = collectionPage.collections.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }

  return categories;
};

const loadAllProducts = async (
  env: CatalogRoutesOptions['catalogEnv'],
  categories: CatalogCategory[],
): Promise<CatalogProduct[]> => {
  const categoryIds = new Set(categories.map((c) => c.id));
  const products: CatalogProduct[] = [];
  let cursor: string | null = null;

  while (true) {
    const productsPage: CatalogProductsResult = await queryStorefront<CatalogProductsResult>(
      env,
      CATALOG_PRODUCTS_QUERY,
      {
        first: PAGE_SIZE_MAX,
        after: cursor,
      },
    );

    const mapped = productsPage.products.edges.map(({ node }) => {
      const collectionIds = Array.from(
        new Set(
          node.collections.edges
            .map((edge) => edge.node.id)
            .filter((value) => typeof value === 'string' && value.length > 0),
        ).values(),
      );
      const matchedCollectionIds = collectionIds.filter((collectionId) =>
        categoryIds.has(collectionId),
      );
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

      return mapProduct(node, resolvedCategoryId ?? 'uncategorized', resolvedCategoryIds);
    });

    products.push(...mapped);

    const pageInfo: ConnectionPageInfo = productsPage.products.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }

  return products;
};

const getLatestStamp = async (
  env: CatalogRoutesOptions['catalogEnv'],
): Promise<{ stamp: string; generatedAt: string }> => {
  const stampData = await queryStorefront<CatalogProductsStampResult>(
    env,
    CATALOG_PRODUCTS_STAMP_QUERY,
    {
      first: 1,
    },
  );

  const latest = stampData.products.edges[0]?.node;
  const stamp = latest?.id && latest.updatedAt ? `${latest.id}:${latest.updatedAt}` : 'empty';
  const generatedAt = nowIso();
  return { stamp, generatedAt };
};

const mapProduct = (
  product: StorefrontProductNode,
  resolvedCategoryId: string,
  resolvedCategoryIds: string[],
): CatalogProduct => {
  const firstVariant = product.variants.edges[0]?.node;
  const priceRon = Number(firstVariant?.price.amount ?? 0);
  const oldPrice = firstVariant?.compareAtPrice?.amount;
  const oldPriceRon = oldPrice ? Number(oldPrice) : undefined;
  const inStock = firstVariant?.availableForSale ?? product.availableForSale;

  return {
    id: product.id,
    categoryId: resolvedCategoryId,
    ...(resolvedCategoryIds.length > 0 ? { categoryIds: resolvedCategoryIds } : {}),
    ...(product.handle ? { handle: product.handle } : {}),
    ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
    ...(firstVariant?.id ? { variantId: firstVariant.id } : {}),
    name: product.title,
    brand: product.vendor || 'Dacus',
    ...(product.description ? { description: product.description } : {}),
    ...(product.featuredImage?.thumbnailUrl
      ? { thumbnailUrl: product.featuredImage.thumbnailUrl }
      : {}),
    ...(product.featuredImage?.imageUrl
      ? { imageUrl: product.featuredImage.imageUrl }
      : product.featuredImage?.thumbnailUrl
        ? { imageUrl: product.featuredImage.thumbnailUrl }
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
  };
};

export const catalogRoutes: FastifyPluginAsync<CatalogRoutesOptions> = async (fastify, options) => {
  let stampCache: { expiresAt: number; payload: CatalogStampApiPayload } | null = null;
  let incrementalSyncInFlight: Promise<
    | { synced: true; categories: number; products: number; stamp: string }
    | { synced: false; reason: 'no_changes'; stamp: string }
  > | null = null;

  const setStampCache = (payload: CatalogStampApiPayload) => {
    stampCache = {
      expiresAt: Date.now() + Math.min(options.catalogEnv.cacheTtlMs, 30_000),
      payload,
    };
  };

  const runFullSync = async () => {
    const categories = await loadAllCollections(options.catalogEnv);
    const products = await loadAllProducts(options.catalogEnv, categories);
    const stamp = await getLatestStamp(options.catalogEnv);

    await Promise.all([
      options.catalogStore.setCategories(categories),
      options.catalogStore.setProducts(products),
      options.catalogStore.setStamp(stamp),
    ]);

    pageCache.clear();
    setStampCache({
      stamp: stamp.stamp,
      source: 'live',
      generatedAt: stamp.generatedAt,
    });

    return { categories: categories.length, products: products.length, stamp: stamp.stamp };
  };

  const runIncrementalSync = async () => {
    const storedStamp = await options.catalogStore.getStamp();
    const latestStamp = await getLatestStamp(options.catalogEnv);

    if (storedStamp && storedStamp.stamp === latestStamp.stamp) {
      setStampCache({
        stamp: latestStamp.stamp,
        source: 'cache',
        generatedAt: latestStamp.generatedAt,
      });
      return { synced: false as const, reason: 'no_changes' as const, stamp: latestStamp.stamp };
    }

    const categories = await loadAllCollections(options.catalogEnv);
    const products = await loadAllProducts(options.catalogEnv, categories);
    await Promise.all([
      options.catalogStore.setCategories(categories),
      options.catalogStore.setProducts(products),
      options.catalogStore.setStamp(latestStamp),
    ]);

    pageCache.clear();
    setStampCache({
      stamp: latestStamp.stamp,
      source: 'live',
      generatedAt: latestStamp.generatedAt,
    });

    return {
      synced: true as const,
      categories: categories.length,
      products: products.length,
      stamp: latestStamp.stamp,
    };
  };

  const ensureIncrementalSync = () => {
    if (!incrementalSyncInFlight) {
      incrementalSyncInFlight = runIncrementalSync().finally(() => {
        incrementalSyncInFlight = null;
      });
    }
    return incrementalSyncInFlight;
  };

  fastify.get('/catalog/stamp', async (_request, reply) => {
    if (stampCache && stampCache.expiresAt > Date.now()) {
      reply.header('Cache-Control', 'private, max-age=15');
      return {
        ...stampCache.payload,
        source: 'cache',
      } satisfies CatalogStampApiPayload;
    }

    try {
      const stampData = await queryStorefront<CatalogProductsStampResult>(
        options.catalogEnv,
        CATALOG_PRODUCTS_STAMP_QUERY,
        {
          first: 1,
        },
      );

      const latest = stampData.products.edges[0]?.node;
      const payload: CatalogStampApiPayload = {
        stamp: latest?.id && latest.updatedAt ? `${latest.id}:${latest.updatedAt}` : 'empty',
        source: 'live',
        generatedAt: nowIso(),
      };

      setStampCache(payload);
      reply.header('Cache-Control', 'private, max-age=15');
      return payload;
    } catch {
      const fallback = await options.catalogStore.getStamp();
      if (fallback) {
        const payload: CatalogStampApiPayload = {
          stamp: fallback.stamp,
          source: 'cache',
          generatedAt: fallback.generatedAt,
        };
        setStampCache(payload);
        reply.header('Cache-Control', 'private, max-age=15');
        return payload;
      }

      reply.code(503);
      return { error: 'Catalog stamp is unavailable.' };
    }
  });

  fastify.get('/catalog', async (request, reply) => {
    const query = request.query as {
      after?: string;
      pageSize?: string;
      lean?: string;
      includeCategories?: string;
    };

    const after = query.after && query.after.length > 0 ? query.after : null;
    const requestedPageSize = Number(query.pageSize ?? PAGE_SIZE_DEFAULT);
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(PAGE_SIZE_MAX, Math.max(10, Math.trunc(requestedPageSize)))
      : PAGE_SIZE_DEFAULT;
    const lean = query.lean !== '0';
    const includeCategories = query.includeCategories !== '0';

    const pageCacheKey = JSON.stringify({ after, pageSize, lean, includeCategories });
    const directCachedPage = getCachedPayload(pageCache, pageCacheKey);
    if (directCachedPage) return directCachedPage;

    // Check store for categories and products
    const [storedCategories, storedProducts, storedStamp] = await Promise.all([
      options.catalogStore.getCategories(),
      options.catalogStore.getProducts(),
      options.catalogStore.getStamp(),
    ]);

    const now = Date.now();
    const stampAge =
      storedStamp && Number.isFinite(Date.parse(storedStamp.generatedAt))
        ? now - Date.parse(storedStamp.generatedAt)
        : Infinity;
    const hasStoredData = storedCategories.length > 0 && storedProducts.length > 0;
    const hasFreshData = hasStoredData && stampAge < options.catalogEnv.cacheTtlMs;

    let categoriesForMapping = storedCategories;
    let allProducts = storedProducts;
    let responseSource: CatalogApiPayload['source'] = hasStoredData ? 'cache' : 'live';

    if (hasFreshData) {
      responseSource = 'cache';
    } else {
      if (hasStoredData) {
        responseSource = 'cache';
        void ensureIncrementalSync().catch((error) => {
          request.log.warn({ err: error }, 'Background incremental catalog sync failed');
        });
      } else {
        try {
          await ensureIncrementalSync();
          [categoriesForMapping, allProducts] = await Promise.all([
            options.catalogStore.getCategories(),
            options.catalogStore.getProducts(),
          ]);
          responseSource = 'live';
        } catch (error) {
          request.log.error({ err: error }, 'Initial catalog sync failed');
          reply.code(503);
          return {
            error: 'Catalog is temporarily unavailable.',
            errorRo: 'Catalogul este indisponibil momentan.',
          };
        }
      }
    }

    // Paginate products from stored - optimize memory usage
    const startIndex = after ? allProducts.findIndex((p) => p.id === after) + 1 : 0;
    const paginatedProducts = allProducts.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < allProducts.length;
    const endCursor = hasMore
      ? (paginatedProducts[paginatedProducts.length - 1]?.id ?? null)
      : null;

    const categoryIds = new Set(categoriesForMapping.map((category) => category.id));
    const hasUncategorizedProducts = paginatedProducts.some(
      (product) => product.categoryId === 'uncategorized' || !categoryIds.has(product.categoryId),
    );

    const normalizedCategories = includeCategories
      ? (() => {
          const base = categoriesForMapping.length > 0 ? [...categoriesForMapping] : [];

          if (hasUncategorizedProducts && !base.some((item) => item.id === 'uncategorized')) {
            base.push({
              id: 'uncategorized',
              name: 'Diverse',
              description: 'Produse fără categorie explicită în Shopify',
            });
          }

          return base;
        })()
      : [];

    const payload: CatalogApiPayload = {
      categories: normalizedCategories,
      products: paginatedProducts,
      hasMoreProducts: hasMore,
      productsCursor: endCursor,
      source: responseSource,
      generatedAt: nowIso(),
    };

    // Cache the page
    setCachedPayload(pageCache, pageCacheKey, options.catalogEnv.cacheTtlMs, payload);

    reply.header('Cache-Control', 'private, max-age=30');
    return payload;
  });

  fastify.post('/catalog/sync', async () => {
    return runFullSync();
  });

  fastify.post('/catalog/sync-incremental', async () => {
    return ensureIncrementalSync();
  });

  fastify.post('/catalog/refresh', async (_request, reply) => {
    // Force refresh from Shopify, ignoring cache
    try {
      const result = await runFullSync();
      return { ok: true, ...result };
    } catch (error) {
      reply.code(500);
      return {
        error: 'Refresh failed',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  });

  fastify.post('/catalog/webhooks/products', async () => {
    // Webhook for product changes
    // For simplicity, trigger sync or update specific product
    // But for now, just acknowledge
    return { ok: true };
  });
};

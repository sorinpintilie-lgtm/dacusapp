import type { FastifyPluginAsync } from 'fastify';

type CatalogRoutesOptions = {
  catalogEnv: {
    shopifyStoreDomain: string;
    storefrontToken: string;
    cacheTtlMs: number;
  };
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

type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
};

type CatalogProduct = {
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

type CatalogApiPayload = {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  hasMoreProducts: boolean;
  productsCursor: string | null;
  source: 'live' | 'cache';
  generatedAt: string;
};

type CachedValue = {
  expiresAt: number;
  payload: CatalogApiPayload;
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

const CATALOG_PRODUCTS_LEAN_QUERY = `
  query DacusCatalogProductsLean($first: Int!, $after: String) {
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
          description(truncateAt: 120)
          availableForSale
          featuredImage {
            thumbnailUrl: url(transform: { maxWidth: 320, maxHeight: 320, crop: CENTER })
            imageUrl: url(transform: { maxWidth: 720, maxHeight: 720, crop: CENTER })
          }
          collections(first: 5) {
            edges {
              node {
                id
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
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

const PAGE_SIZE_MAX = 250;
const PAGE_SIZE_DEFAULT = 60;
const collectionsCache = new Map<string, CachedValue>();
const pageCache = new Map<string, CachedValue>();

const nowIso = () => new Date().toISOString();

const getCachedPayload = (store: Map<string, CachedValue>, key: string): CatalogApiPayload | null => {
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

const setCachedPayload = (store: Map<string, CachedValue>, key: string, ttlMs: number, payload: CatalogApiPayload) => {
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

const loadAllCollections = async (env: CatalogRoutesOptions['catalogEnv']): Promise<CatalogCategory[]> => {
  const categories: CatalogCategory[] = [];
  let cursor: string | null = null;

  while (true) {
    const collectionPage: CatalogCollectionsResult = await queryStorefront<CatalogCollectionsResult>(
      env,
      CATALOG_COLLECTIONS_QUERY,
      {
        first: PAGE_SIZE_MAX,
        after: cursor,
      },
    );

    const mapped = collectionPage.collections.edges.map(({ node }: { node: StorefrontCollectionNode }) => ({
      id: node.id,
      name: node.title,
      description: node.description || 'Categorie produse Dacus',
      ...(node.image?.url ? { imageUrl: node.image.url } : {}),
    }));

    categories.push(...mapped);

    const pageInfo: ConnectionPageInfo = collectionPage.collections.pageInfo;
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }

  return categories;
};

const mapProduct = (product: StorefrontProductNode, categoryIds: Set<string>, defaultCategoryId: string): CatalogProduct => {
  const firstVariant = product.variants.edges[0]?.node;
  const priceRon = Number(firstVariant?.price.amount ?? 0);
  const oldPrice = firstVariant?.compareAtPrice?.amount;
  const oldPriceRon = oldPrice ? Number(oldPrice) : undefined;
  const inStock = firstVariant?.availableForSale ?? product.availableForSale;

  const collectionIds = product.collections.edges.map((edge) => edge.node.id);
  const resolvedCategoryId = collectionIds.find((collectionId) => categoryIds.has(collectionId)) ?? defaultCategoryId;

  return {
    id: product.id,
    categoryId: resolvedCategoryId,
    ...(product.handle ? { handle: product.handle } : {}),
    ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
    name: product.title,
    brand: product.vendor || 'Dacus',
    ...(product.description ? { description: product.description } : {}),
    ...(product.featuredImage?.thumbnailUrl ? { thumbnailUrl: product.featuredImage.thumbnailUrl } : {}),
    ...(product.featuredImage?.imageUrl
      ? { imageUrl: product.featuredImage.imageUrl }
      : product.featuredImage?.thumbnailUrl
        ? { imageUrl: product.featuredImage.thumbnailUrl }
        : {}),
    priceRon,
    ...(typeof oldPriceRon === 'number' ? { oldPriceRon } : {}),
    stockLabel: inStock ? 'În stoc' : 'Indisponibil',
  };
};

export const catalogRoutes: FastifyPluginAsync<CatalogRoutesOptions> = async (fastify, options) => {
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

    let categories: CatalogCategory[] = [];
    if (includeCategories) {
      const categoriesCacheKey = 'collections:all';
      const cachedCollections = getCachedPayload(collectionsCache, categoriesCacheKey);
      if (cachedCollections) {
        categories = cachedCollections.categories;
      }
    }

    const productsPromise = queryStorefront<CatalogProductsResult>(
      options.catalogEnv,
      lean ? CATALOG_PRODUCTS_LEAN_QUERY : CATALOG_PRODUCTS_QUERY,
      {
        first: pageSize,
        after,
      },
    );

    const categoriesPromise = includeCategories && categories.length === 0 ? loadAllCollections(options.catalogEnv) : null;

    const [productsData, liveCategories] = await Promise.all([productsPromise, categoriesPromise]);

    if (liveCategories && includeCategories) {
      categories = liveCategories;

      setCachedPayload(collectionsCache, 'collections:all', options.catalogEnv.cacheTtlMs, {
        categories,
        products: [],
        hasMoreProducts: false,
        productsCursor: null,
        source: 'live',
        generatedAt: nowIso(),
      });
    }

    const normalizedCategories = includeCategories
      ? categories.length
        ? [
            ...categories,
            {
              id: 'uncategorized',
              name: 'Diverse',
              description: 'Produse fără categorie explicită în Shopify',
            },
          ]
        : [
            {
              id: 'uncategorized',
              name: 'Toate produsele',
              description: 'Produse Dacus',
            },
          ]
      : [];

    const categoryIds = new Set(categories.map((category) => category.id));
    const products = productsData.products.edges.map(({ node }) => mapProduct(node, categoryIds, 'uncategorized'));

    const payload: CatalogApiPayload = {
      categories: normalizedCategories,
      products,
      hasMoreProducts: !!productsData.products.pageInfo.hasNextPage,
      productsCursor: productsData.products.pageInfo.endCursor ?? null,
      source: 'live',
      generatedAt: nowIso(),
    };

    setCachedPayload(pageCache, pageCacheKey, options.catalogEnv.cacheTtlMs, payload);

    reply.header('Cache-Control', 'private, max-age=30');
    return payload;
  });
};


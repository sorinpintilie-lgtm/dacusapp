import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import type { SearchIndex, SearchProductDocument } from '../services/searchIndex.js';

type SearchRoutesOptions = {
  searchIndex: SearchIndex;
  searchEnv: {
    maxPerPage: number;
    syncSecret: string;
    shopifyStoreDomain: string;
    shopifyAdminToken: string;
    webhookSecret: string;
    appUrl?: string;
  };
};

type ShopifyAdminProductsResult = {
  products: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    edges: Array<{
      node: ShopifyAdminProductNode;
    }>;
  };
};

type ShopifyAdminProductByIdResult = {
  product: ShopifyAdminProductNode | null;
};

type ShopifyAdminProductNode = {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  createdAt: string;
  status?: string | null;
  featuredImage?: {
    url?: string | null;
  } | null;
  collections?: {
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
        price?: string | null;
        compareAtPrice?: string | null;
        inventoryQuantity?: number | null;
      };
    }>;
  };
};

type ShopifyAdminGraphQLError = {
  message: string;
};

type ShopifyAdminGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyAdminGraphQLError[];
};

const PRODUCTS_SYNC_QUERY = `
  query DacusSyncProducts($cursor: String) {
    products(first: 250, after: $cursor, sortKey: ID) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          description
          vendor
          productType
          tags
          createdAt
          status
          featuredImage {
            url
          }
          collections(first: 20) {
            edges {
              node {
                id
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                sku
                price
                compareAtPrice
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_ID_QUERY = `
  query DacusProductById($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      description
      vendor
      productType
      tags
      createdAt
      status
      featuredImage {
        url
      }
      collections(first: 20) {
        edges {
          node {
            id
          }
        }
      }
      variants(first: 10) {
        edges {
          node {
            sku
            price
            compareAtPrice
            inventoryQuantity
          }
        }
      }
    }
  }
`;

const PRODUCT_WEBHOOK_TOPICS = ['products/create', 'products/update', 'products/delete'] as const;

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeGidProductId = (value: string | number) => {
  const source = String(value).trim();
  if (source.startsWith('gid://shopify/Product/')) return source;
  if (/^\d+$/.test(source)) return `gid://shopify/Product/${source}`;
  return source;
};

const parseBoolean = (value: string | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
};

const parseCsv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const escapeFilterValue = (value: string) => `\`${value.replace(/[`\\]/g, '\\$&')}\``;

const buildSortBy = (value: string | undefined) => {
  if (!value || value === 'relevanta') return '_text_match:desc,createdAt:desc';
  if (value === 'pretCrescator') return 'price:asc';
  if (value === 'pretDescrescator') return 'price:desc';
  if (value === 'numeAZ') return 'title:asc';
  return value;
};

const buildFilterBy = (query: {
  categoryId?: string;
  vendor?: string;
  availableForSale?: string;
  priceMin?: string;
  priceMax?: string;
}) => {
  const filters: string[] = [];

  const categoryIds = parseCsv(query.categoryId);
  if (categoryIds.length > 0) {
    filters.push(`categoryIds:[${categoryIds.map(escapeFilterValue).join(',')}]`);
  }

  const vendors = parseCsv(query.vendor);
  if (vendors.length > 0) {
    filters.push(`vendor:[${vendors.map(escapeFilterValue).join(',')}]`);
  }

  const availability = parseBoolean(query.availableForSale);
  if (availability !== null) {
    filters.push(`availableForSale:${availability}`);
  }

  const minPrice = toNumber(query.priceMin);
  const maxPrice = toNumber(query.priceMax);
  if (Number.isFinite(minPrice) && minPrice > 0) {
    filters.push(`price:>=${minPrice}`);
  }
  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    filters.push(`price:<=${maxPrice}`);
  }

  return filters.join(' && ');
};

const mapSearchDocumentToMobileProduct = (doc: SearchProductDocument, preferredCategoryIds: string[] = []) => {
  const matchedPreferredCategoryId = preferredCategoryIds.find((value) =>
    Array.isArray(doc.categoryIds) ? doc.categoryIds.includes(value) : false,
  );

  const resolvedCategoryId =
    matchedPreferredCategoryId && matchedPreferredCategoryId.trim().length > 0
      ? matchedPreferredCategoryId
      : doc.categoryId && doc.categoryId.trim().length > 0
      ? doc.categoryId
      : Array.isArray(doc.categoryIds) && doc.categoryIds.length > 0
        ? doc.categoryIds[0] ?? 'uncategorized'
        : 'uncategorized';
  const hasOldPrice = typeof doc.compareAtPrice === 'number' && doc.compareAtPrice > doc.price;
  const inStock = doc.availableForSale;

  return {
    id: doc.id,
    categoryId: resolvedCategoryId,
    ...(doc.handle ? { handle: doc.handle } : {}),
    ...(doc.sku ? { sku: doc.sku } : {}),
    variantId: doc.sku || doc.id,
    name: doc.title,
    brand: doc.vendor || 'Dacus',
    ...(doc.description ? { description: doc.description } : {}),
    ...(doc.thumbnailUrl ? { thumbnailUrl: doc.thumbnailUrl } : {}),
    ...(doc.imageUrl ? { imageUrl: doc.imageUrl } : {}),
    priceRon: doc.price,
    ...(hasOldPrice ? { oldPriceRon: doc.compareAtPrice } : {}),
    stockLabel: inStock ? 'În stoc' : 'Stoc epuizat',
    variants: [
      {
        id: doc.sku || doc.id,
        name: doc.sku ? `Varianta ${doc.sku}` : 'Varianta standard',
        priceRon: doc.price,
        inStock,
      },
    ],
  };
};

const mapAdminProductToSearchDocument = (product: ShopifyAdminProductNode): SearchProductDocument => {
  const variants = product.variants.edges.map((edge) => edge.node);
  const firstVariant = variants[0];
  const fallbackCategory = product.productType?.trim() ? `product-type-${toSlug(product.productType) || 'diverse'}` : 'uncategorized';
  const collectionIds = Array.from(
    new Set(
      (product.collections?.edges ?? [])
        .map((edge) => edge.node.id)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ).values(),
  );
  const normalizedCategoryIds = collectionIds.length > 0 ? collectionIds : [fallbackCategory];
  const collectionId = normalizedCategoryIds[0] ?? fallbackCategory;
  const price = toNumber(firstVariant?.price);
  const compareAtPrice = toNumber(firstVariant?.compareAtPrice);
  const availableForSale = (firstVariant?.inventoryQuantity ?? 0) > 0 || (product.status ?? '').toUpperCase() === 'ACTIVE';
  const imageUrl = product.featuredImage?.url?.trim() ?? '';

  return {
    id: normalizeGidProductId(product.id),
    title: product.title?.trim() || 'Produs Dacus',
    handle: product.handle?.trim() || '',
    description: (product.description ?? '').slice(0, 1200),
    vendor: (product.vendor ?? 'Dacus').trim() || 'Dacus',
    productType: (product.productType ?? '').trim() || 'Diverse',
    tags: Array.isArray(product.tags) ? product.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0) : [],
    price,
    ...(compareAtPrice > 0 ? { compareAtPrice } : {}),
    hasDiscount: compareAtPrice > price && compareAtPrice > 0,
    availableForSale,
    imageUrl,
    thumbnailUrl: imageUrl,
    variantCount: Math.max(1, variants.length),
    categoryId: collectionId,
    categoryIds: normalizedCategoryIds,
    sku: (firstVariant?.sku ?? '').trim(),
    createdAt: Math.floor(new Date(product.createdAt).getTime() / 1000),
  };
};

const queryShopifyAdmin = async <T>(
  env: SearchRoutesOptions['searchEnv'],
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const endpoint = `https://${env.shopifyStoreDomain}/admin/api/2024-10/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.shopifyAdminToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify Admin request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ShopifyAdminGraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('Shopify Admin response did not include data');
  }

  return payload.data;
};

const verifyWebhookPayload = (
  secret: string,
  payload: unknown,
  hmacHeader: string | undefined,
  rawBody?: string | Buffer,
) => {
  if (!secret) return true;
  if (!hmacHeader) return false;

  const bodyForSignature =
    typeof rawBody !== 'undefined' ? rawBody : typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});

  const hmac = createHmac('sha256', secret);
  if (Buffer.isBuffer(bodyForSignature)) {
    hmac.update(bodyForSignature);
  } else {
    hmac.update(bodyForSignature, 'utf8');
  }

  const digest = hmac.digest('base64');

  const expected = Buffer.from(digest);
  const received = Buffer.from(hmacHeader);
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
};

const normalizeSuggestion = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const searchRoutes: FastifyPluginAsync<SearchRoutesOptions> = async (fastify, options) => {
  fastify.get('/search/products', async (request, reply) => {
    const query = request.query as {
      q?: string;
      page?: string;
      perPage?: string;
      sortBy?: string;
      categoryId?: string;
      vendor?: string;
      availableForSale?: string;
      priceMin?: string;
      priceMax?: string;
      onlyDiscount?: string;
      facets?: string;
    };

    if (!options.searchIndex.enabled) {
      reply.code(503);
      return {
        error: 'Search index is disabled.',
        products: [] as unknown[],
        total: 0,
        page: 1,
        perPage: 0,
        hasMore: false,
        facets: [] as unknown[],
      };
    }

    const page = Math.max(1, Math.trunc(toNumber(query.page) || 1));
    const perPage = Math.min(options.searchEnv.maxPerPage, Math.max(10, Math.trunc(toNumber(query.perPage) || 48)));
    const sortBy = buildSortBy(query.sortBy);
    const requestedCategoryIds = parseCsv(query.categoryId);
    const filterBy = buildFilterBy(query);
    const onlyDiscount = query.onlyDiscount === '1' || query.onlyDiscount === 'true';
    const combinedFilterBy = [filterBy, onlyDiscount ? 'hasDiscount:true' : ''].filter((item) => item.length > 0).join(' && ');
    const includeFacets = query.facets === '1' || page === 1;

    const result = await options.searchIndex.searchDocuments({
      query: (query.q ?? '').trim() || '*',
      page,
      perPage,
      sortBy,
      ...(combinedFilterBy ? { filterBy: combinedFilterBy } : {}),
      ...(includeFacets ? { facetBy: 'categoryId,vendor,availableForSale,productType' } : {}),
    });

    const products = result.hits.map((hit) => mapSearchDocumentToMobileProduct(hit.document, requestedCategoryIds));

    return {
      products,
      total: result.found,
      page,
      perPage,
      hasMore: page * perPage < result.found,
      facets: result.facet_counts ?? [],
      source: 'typesense',
    };
  });

  fastify.get('/search/suggestions', async (request) => {
    const query = request.query as { q?: string };
    const q = (query.q ?? '').trim();
    if (q.length < 2 || !options.searchIndex.enabled) {
      return { suggestions: [] as string[] };
    }

    const normalizedQuery = normalizeSuggestion(q);
    const result = await options.searchIndex.searchDocuments({
      query: q,
      page: 1,
      perPage: 12,
      sortBy: '_text_match:desc,createdAt:desc',
    });

    const suggestions = Array.from(
      new Set(
        result.hits
          .flatMap((hit) => [hit.document.title, hit.document.vendor, hit.document.sku, hit.document.handle])
          .map((value) => value.trim())
          .filter((value) => value.length >= 2)
          .filter((value) => normalizeSuggestion(value).includes(normalizedQuery)),
      ),
    ).slice(0, 12);

    return { suggestions };
  });

  fastify.post('/search/sync-products', async (request, reply) => {
    if ((request.headers['x-sync-secret'] ?? '') !== options.searchEnv.syncSecret || !options.searchEnv.syncSecret) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    if (!options.searchIndex.enabled) {
      reply.code(503);
      return { error: 'Search index is disabled.' };
    }

    await options.searchIndex.ensureCollection();

    let cursor: string | null = null;
    let totalSynced = 0;

    do {
      const pageData: ShopifyAdminProductsResult = await queryShopifyAdmin<ShopifyAdminProductsResult>(
        options.searchEnv,
        PRODUCTS_SYNC_QUERY,
        {
        cursor,
        },
      );

      const products = pageData.products.edges.map((edge: { node: ShopifyAdminProductNode }) => edge.node);
      const docs = products.map((product: ShopifyAdminProductNode) => mapAdminProductToSearchDocument(product));
      await options.searchIndex.upsertDocuments(docs);

      totalSynced += docs.length;
      cursor = pageData.products.pageInfo.hasNextPage ? pageData.products.pageInfo.endCursor : null;
    } while (cursor);

    return { ok: true, totalSynced };
  });

  fastify.post('/search/webhooks/products', async (request, reply) => {
    if (!options.searchIndex.enabled) {
      reply.code(503);
      return { error: 'Search index is disabled.' };
    }

    const hmacHeader = typeof request.headers['x-shopify-hmac-sha256'] === 'string' ? request.headers['x-shopify-hmac-sha256'] : undefined;
    const topic = typeof request.headers['x-shopify-topic'] === 'string' ? request.headers['x-shopify-topic'] : '';
    const rawBody = (request as { rawBody?: string | Buffer }).rawBody;
    const payload = (() => {
      const body = request.body;
      if (typeof body === 'string') {
        try {
          return JSON.parse(body) as { id?: string | number };
        } catch {
          return {};
        }
      }

      if (Buffer.isBuffer(body)) {
        try {
          return JSON.parse(body.toString('utf8')) as { id?: string | number };
        } catch {
          return {};
        }
      }

      return (body ?? {}) as { id?: string | number };
    })();

    if (!verifyWebhookPayload(options.searchEnv.webhookSecret, payload, hmacHeader, rawBody)) {
      reply.code(401);
      return { error: 'Invalid webhook signature.' };
    }

    if (!PRODUCT_WEBHOOK_TOPICS.includes(topic as (typeof PRODUCT_WEBHOOK_TOPICS)[number])) {
      return { ok: true };
    }

    if (topic === 'products/delete') {
      const rawId = payload?.id;
      if (!rawId) return { ok: true };
      await options.searchIndex.deleteDocument(normalizeGidProductId(rawId));
      return { ok: true };
    }

    const rawId = payload?.id;
    if (!rawId) {
      reply.code(400);
      return { error: 'Missing product id in webhook payload.' };
    }

    const productId = normalizeGidProductId(rawId);
    const data = await queryShopifyAdmin<ShopifyAdminProductByIdResult>(options.searchEnv, PRODUCT_BY_ID_QUERY, {
      id: productId,
    });

    if (!data.product) {
      return { ok: true };
    }

    const doc = mapAdminProductToSearchDocument(data.product);
    await options.searchIndex.upsertDocument(doc);
    return { ok: true };
  });

  fastify.post('/search/register-product-webhooks', async (request, reply) => {
    if ((request.headers['x-sync-secret'] ?? '') !== options.searchEnv.syncSecret || !options.searchEnv.syncSecret) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    if (!options.searchEnv.appUrl) {
      reply.code(400);
      return { error: 'APP_URL is required to register webhooks.' };
    }

    const webhookAddress = `${options.searchEnv.appUrl.replace(/\/$/, '')}/search/webhooks/products`;

    const created: string[] = [];
    for (const topic of PRODUCT_WEBHOOK_TOPICS) {
      const response = await fetch(`https://${options.searchEnv.shopifyStoreDomain}/admin/api/2024-10/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': options.searchEnv.shopifyAdminToken,
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookAddress,
            format: 'json',
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        request.log.warn({ topic, status: response.status, body }, 'Failed to register Shopify webhook');
        continue;
      }

      created.push(topic);
    }

    return {
      ok: true,
      address: webhookAddress,
      topics: created,
    };
  });
};


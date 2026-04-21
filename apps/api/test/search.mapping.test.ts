import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';
import type { SearchIndex, SearchProductDocument } from '../src/services/searchIndex.js';

type SearchParams = {
  query: string;
  page: number;
  perPage: number;
  sortBy: string;
  filterBy?: string;
  facetBy?: string;
};

const sampleDocument: SearchProductDocument = {
  id: 'gid://shopify/Product/1',
  title: 'Polizor profesional',
  handle: 'polizor-profesional',
  description: 'Model test pentru filtrare multi-colecție',
  vendor: 'Dacus',
  productType: 'Scule',
  tags: ['promo'],
  price: 499,
  compareAtPrice: 599,
  hasDiscount: true,
  availableForSale: true,
  imageUrl: 'https://example.com/p1.jpg',
  thumbnailUrl: 'https://example.com/p1-thumb.jpg',
  variantCount: 1,
  categoryId: 'cat-primary',
  categoryIds: ['cat-primary', 'cat-secondary'],
  sku: 'SKU-1',
  createdAt: 1,
};

const createMockSearchIndex = (): SearchIndex => ({
  enabled: true,
  ensureCollection: async () => undefined,
  upsertDocuments: async () => undefined,
  upsertDocument: async () => undefined,
  deleteDocument: async () => undefined,
  searchDocuments: async ({ filterBy }: SearchParams) => {
    const categoryValues = Array.from(
      (filterBy ?? '').matchAll(/categoryIds:\[([^\]]+)\]/g),
      (match) => match[1] ?? '',
    )
      .flatMap((block) =>
        block
          .split(',')
          .map((item) => item.trim().replace(/^`|`$/g, ''))
          .filter((item) => item.length > 0),
      )
      .filter((item, index, self) => self.indexOf(item) === index);

    const shouldInclude =
      categoryValues.length === 0 || categoryValues.some((value) => sampleDocument.categoryIds.includes(value));

    return {
      hits: shouldInclude ? [{ document: sampleDocument }] : [],
      found: shouldInclude ? 1 : 0,
      page: 1,
      facet_counts: [
        {
          field_name: 'categoryIds',
          counts: [
            { value: 'cat-primary', count: 1 },
            { value: 'cat-secondary', count: 1 },
          ],
        },
      ],
    };
  },
});

let app: Awaited<ReturnType<typeof buildServer>>;

const initApp = async () => {
  app = await buildServer({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  CORS_ALLOWED_ORIGINS: ['*'],
  LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-search-mapping-1234567890',
  SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
  SHOPIFY_STOREFRONT_TOKEN: 'test-token',
  SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-admin-token',
  SHOPIFY_WEBHOOK_SECRET: '',
  CATALOG_CACHE_TTL_MS: 60_000,
  SEARCH_MAX_PER_PAGE: 60,
  TYPESENSE_ENABLED: false,
  TYPESENSE_PORT: 443,
  TYPESENSE_PROTOCOL: 'https',
  TYPESENSE_COLLECTION: 'products',
  TYPESENSE_TIMEOUT_SECONDS: 5,
  SYNC_SECRET: '',
  POS_SCAN_API_KEYS: [],
  FIREBASE_ENABLED: false,
  searchIndex: createMockSearchIndex(),
  });
};

describe('search category mapping', () => {
  beforeAll(async () => {
    await initApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns product for secondary category membership and maps result category to requested category', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/search/products?q=*&categoryId=cat-secondary&page=1&perPage=24&sortBy=relevanta',
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      products: Array<{ id: string; categoryId: string }>;
      total: number;
    };

    expect(payload.total).toBe(1);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0]?.id).toBe(sampleDocument.id);
    expect(payload.products[0]?.categoryId).toBe('cat-secondary');
  });
});


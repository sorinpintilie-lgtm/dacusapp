import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

describe('cart replace route', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let sessionToken = '';

  beforeAll(async () => {
    app = await buildServer({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: ['*'],
      LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-cart-replace-routes-1234567890',
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
    });
    await app.ready();

    const email = `cart-replace-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password: 'password123',
        name: 'Cart Replace User',
      },
    });

    expect(registerResponse.statusCode).toBe(200);
    const registerPayload = registerResponse.json() as { sessionToken: string };
    sessionToken = registerPayload.sessionToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthorized replace attempts', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/cart/replace',
      payload: { lines: [] },
    });

    expect(response.statusCode).toBe(401);
  });

  it('replaces full cart content, dedupes by line key, and removes zero quantities', async () => {
    const seedResponse = await app.inject({
      method: 'PUT',
      url: '/cart/lines',
      headers: {
        'x-session-token': sessionToken,
      },
      payload: {
        productId: 'gid://shopify/Product/seed',
        quantity: 1,
        unitPriceRon: 11,
      },
    });
    expect(seedResponse.statusCode).toBe(200);

    const replaceResponse = await app.inject({
      method: 'PUT',
      url: '/cart/replace',
      headers: {
        'x-session-token': sessionToken,
      },
      payload: {
        lines: [
          {
            productId: 'gid://shopify/Product/1',
            variantId: 'gid://shopify/ProductVariant/11',
            quantity: 2,
            unitPriceRon: 33.5,
          },
          {
            productId: 'gid://shopify/Product/2',
            quantity: 1,
            unitPriceRon: 18,
          },
          {
            productId: 'gid://shopify/Product/1',
            variantId: 'gid://shopify/ProductVariant/11',
            quantity: 4,
            unitPriceRon: 33.5,
          },
          {
            productId: 'gid://shopify/Product/3',
            quantity: 0,
            unitPriceRon: 7,
          },
        ],
      },
    });

    expect(replaceResponse.statusCode).toBe(200);
    const replacePayload = replaceResponse.json() as {
      lines: Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        unitPriceRon: number;
      }>;
    };
    expect(replacePayload.lines).toHaveLength(2);
    expect(replacePayload.lines).toContainEqual({
      productId: 'gid://shopify/Product/1',
      variantId: 'gid://shopify/ProductVariant/11',
      quantity: 4,
      unitPriceRon: 33.5,
    });
    expect(replacePayload.lines).toContainEqual({
      productId: 'gid://shopify/Product/2',
      quantity: 1,
      unitPriceRon: 18,
    });

    const getResponse = await app.inject({
      method: 'GET',
      url: '/cart',
      headers: {
        'x-session-token': sessionToken,
      },
    });

    expect(getResponse.statusCode).toBe(200);
    const getPayload = getResponse.json() as { lines: unknown[] };
    expect(getPayload.lines).toEqual(replacePayload.lines);
  });

  it('rejects replace payload when unitPriceRon is missing for positive quantity', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/cart/replace',
      headers: {
        'x-session-token': sessionToken,
      },
      payload: {
        lines: [
          {
            productId: 'gid://shopify/Product/9',
            quantity: 2,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

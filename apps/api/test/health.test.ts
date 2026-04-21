import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

describe('health route', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: ['*'],
      LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-health-route',
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns service health payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json() as { status: string; service: string };
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('dacus-loyalty-api');
  });
});


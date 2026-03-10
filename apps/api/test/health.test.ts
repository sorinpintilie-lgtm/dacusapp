import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

describe('health route', () => {
  const app = buildServer({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CORS_ALLOWED_ORIGINS: ['*'],
    SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
    SHOPIFY_STOREFRONT_TOKEN: 'test-token',
    CATALOG_CACHE_TTL_MS: 60_000,
  });

  beforeAll(async () => {
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


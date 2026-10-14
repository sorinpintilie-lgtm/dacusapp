import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

describe('account deletion', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: ['*'],
      LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-account-delete',
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

  it('refuses anonymous requests', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/account' });
    expect(response.statusCode).toBe(401);
  });

  it('removes the account and everything stored for it', async () => {
    const email = `delete-${Date.now()}@example.com`;
    const password = 'password123';
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password, name: 'De șters' },
    });
    expect(register.statusCode).toBe(200);
    const { sessionToken } = register.json() as { sessionToken: string };
    const headers = { authorization: `Bearer ${sessionToken}` };

    const wishlist = await app.inject({ method: 'PUT', url: '/wishlist/product-1', headers, payload: { active: true } });
    expect([200, 201]).toContain(wishlist.statusCode);

    const removed = await app.inject({ method: 'DELETE', url: '/account', headers });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ ok: true });

    // The session is gone, the data is gone, and the credentials no longer work.
    expect((await app.inject({ method: 'GET', url: '/auth/session', headers })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/wishlist', headers })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
    expect(login.statusCode).toBe(401);

    // The same email can sign up again from scratch.
    const again = await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password, name: 'Nou' } });
    expect(again.statusCode).toBe(200);
  });
});

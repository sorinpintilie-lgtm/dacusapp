// End-to-end check of app logins against the Firebase Auth emulator (no real project involved).
// Run: start `firebase emulators:start --only auth --project demo-dacus`, then
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx vitest run test/firebase-login.emulator.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST;

describe.skipIf(!EMULATOR)('Firebase app logins (Auth emulator)', () => {
  let app: Awaited<ReturnType<typeof import('../src/server.js').buildServer>>;
  const identity = `http://${EMULATOR}/identitytoolkit.googleapis.com/v1`;

  const firebase = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(`${identity}/${path}?key=demo-key`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: (await response.json()) as { idToken?: string } };
  };

  beforeAll(async () => {
    process.env.GCLOUD_PROJECT = 'demo-dacus';
    // Nothing in this test may reach a real Firestore.
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:1';
    const { buildServer } = await import('../src/server.js');
    app = await buildServer({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: ['*'],
      LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-emulator',
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
    await app?.close();
  });

  it('gives a new app account a profile on first use, and deletes it completely', async () => {
    const email = `app-${Date.now()}@example.com`;
    const password = 'password123';
    const signUp = await firebase('accounts:signUp', { email, password, returnSecureToken: true });
    expect(signUp.status).toBe(200);
    const headers = { authorization: `Bearer ${signUp.json.idToken}` };

    // Before the fix this was 401: the server had no profile for accounts created in the app.
    const settings = await app.inject({ method: 'GET', url: '/account/settings', headers });
    expect(settings.statusCode).toBe(200);

    const add = await app.inject({ method: 'PUT', url: '/wishlist/product-1', headers, payload: { active: true } });
    expect(add.statusCode).toBe(200);
    const wishlist = await app.inject({ method: 'GET', url: '/wishlist', headers });
    expect(wishlist.json()).toMatchObject({ productIds: ['product-1'] });

    const removed = await app.inject({ method: 'DELETE', url: '/account', headers });
    expect(removed.statusCode).toBe(200);

    // The Firebase login is gone too…
    const signIn = await firebase('accounts:signInWithPassword', { email, password, returnSecureToken: true });
    expect(signIn.status).toBe(400);
    // …and the still-unexpired token does not bring the profile back.
    const after = await app.inject({ method: 'GET', url: '/wishlist', headers });
    expect(after.statusCode).toBe(401);
  });
});

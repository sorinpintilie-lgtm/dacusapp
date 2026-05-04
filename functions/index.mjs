import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

import { loadEnv } from './api-dist/config/env.js';
import { buildServer } from './api-dist/server.js';

const ensureRuntimeEnvDefaults = () => {
  process.env.NODE_ENV ??= 'production';
  process.env.LOG_LEVEL ??= 'info';
  process.env.CORS_ALLOWED_ORIGINS ??= '*';
  process.env.CATALOG_CACHE_TTL_MS ??= '60000';
  process.env.SEARCH_MAX_PER_PAGE ??= '60';

  // Required by API env schema; override in Cloud Functions env for production secrets.
  process.env.SHOPIFY_STORE_DOMAIN ??= 'f4eb2c-ae.myshopify.com';
  process.env.SHOPIFY_STOREFRONT_TOKEN ??= 'replace-with-storefront-token';
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ??= 'replace-with-admin-token';
  process.env.SHOPIFY_WEBHOOK_SECRET ??= '';
  process.env.SYNC_SECRET ??= '';
  process.env.APP_URL ??= 'https://europe-west1-dacus-b40f9.cloudfunctions.net/api';
  process.env.TYPESENSE_ENABLED ??= '';
  process.env.TYPESENSE_HOST ??= '';
  process.env.TYPESENSE_PORT ??= '443';
  process.env.TYPESENSE_PROTOCOL ??= 'https';
  process.env.TYPESENSE_ADMIN_KEY ??= '';
  process.env.TYPESENSE_COLLECTION ??= 'products';
  process.env.TYPESENSE_TIMEOUT_SECONDS ??= '5';
  process.env.LOYALTY_QR_SIGNING_KEY ??= '8e4f67c9a1d24b0fbe36d0f2d9a7c43f5e2b6a0d4f9c71ea83b2d65f14ac9e7d';
  process.env.POS_SCAN_API_KEYS ??= '';

  // Firebase Functions .env cannot contain keys starting with FIREBASE_.
  // Map project-scoped keys to runtime keys expected by the API schema.
  process.env.FIREBASE_ENABLED ??= process.env.DACUS_FIREBASE_ENABLED;
  process.env.FIREBASE_PROJECT_ID ??= process.env.DACUS_FIREBASE_PROJECT_ID;
  process.env.FIREBASE_CLIENT_EMAIL ??= process.env.DACUS_FIREBASE_CLIENT_EMAIL;
  process.env.FIREBASE_PRIVATE_KEY ??= process.env.DACUS_FIREBASE_PRIVATE_KEY;
  process.env.FIREBASE_DATABASE_URL ??= process.env.DACUS_FIREBASE_DATABASE_URL;
  process.env.FIREBASE_STORAGE_BUCKET ??= process.env.DACUS_FIREBASE_STORAGE_BUCKET;

  // Keep disabled by default until explicit credentials are configured.
  // NOTE: empty string parses to false.
  process.env.FIREBASE_ENABLED ??= '';
};

setGlobalOptions({
  region: 'europe-west1',
  maxInstances: 10,
});

let appPromise = null;

const toInjectHeaders = (headers) => {
  const normalized = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value == null) continue;
    normalized[key] = Array.isArray(value) ? value.join(',') : String(value);
  }

  return normalized;
};

const getInjectPayload = (request) => {
  const method = (request.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return undefined;

  if (request.rawBody && request.rawBody.length > 0) {
    return request.rawBody;
  }

  if (request.body == null) return undefined;
  if (Buffer.isBuffer(request.body) || typeof request.body === 'string') return request.body;

  return JSON.stringify(request.body);
};

const writeInjectResponse = (response, result, method) => {
  response.statusCode = result.statusCode;

  for (const [key, value] of Object.entries(result.headers ?? {})) {
    if (value == null) continue;
    response.setHeader(key, Array.isArray(value) ? value : String(value));
  }

  if ((method ?? 'GET').toUpperCase() === 'HEAD' || result.statusCode === 204 || result.statusCode === 304) {
    response.end();
    return;
  }

  response.end(result.rawPayload ?? result.body ?? '');
};

const normalizeFastifyUrl = (value) => {
  const raw = typeof value === 'string' && value.length > 0 ? value : '/';

  if (raw === '/api' || raw === '/api/') return '/';
  if (raw.startsWith('/api/')) return raw.slice(4);

  return raw;
};

const getServer = async () => {
  if (!appPromise) {
    appPromise = (async () => {
      ensureRuntimeEnvDefaults();
      const app = buildServer(loadEnv());
      await app.ready();
      return app;
    })();
  }

  return appPromise;
};

export const api = onRequest({ cors: true, invoker: 'public' }, async (request, response) => {
  const app = await getServer();
  const payload = getInjectPayload(request);

  const result = await app.inject({
    method: request.method,
    url: normalizeFastifyUrl(request.originalUrl ?? request.url),
    headers: toInjectHeaders(request.headers),
    ...(payload !== undefined ? { payload } : {}),
  });

  writeInjectResponse(response, result, request.method);
});

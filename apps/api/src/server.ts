import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import type { AppEnv } from './config/env.js';
import { catalogRoutes } from './routes/catalog.js';
import { healthRoutes } from './routes/health.js';
import { searchRoutes } from './routes/search.js';
import { authRoutes } from './routes/auth.js';
import { cartRoutes } from './routes/cart.js';
import { orderRoutes } from './routes/orders.js';
import { loyaltyRoutes } from './routes/loyalty.js';
import { accountRoutes } from './routes/account.js';
import { createCatalogStore } from './services/catalogStore.js';
import { createInMemoryCommerceStore } from './services/commerceStore.js';
import { createFirestoreClient } from './services/firebase.js';
import { createSearchIndex, type SearchIndex } from './services/searchIndex.js';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Auth endpoints - stricter limits
  auth: { max: 5, timeWindow: '1 minute' },
  // Checkout and payment - very strict
  checkout: { max: 10, timeWindow: '1 minute' },
  // General API - more permissive
  default: { max: 100, timeWindow: '1 minute' },
};

type ServerEnv = Pick<
  AppEnv,
  | 'NODE_ENV'
  | 'LOG_LEVEL'
  | 'CORS_ALLOWED_ORIGINS'
  | 'LOYALTY_QR_SIGNING_KEY'
  | 'SHOPIFY_STORE_DOMAIN'
  | 'SHOPIFY_STOREFRONT_TOKEN'
  | 'SHOPIFY_ADMIN_ACCESS_TOKEN'
  | 'SHOPIFY_WEBHOOK_SECRET'
  | 'CATALOG_CACHE_TTL_MS'
  | 'SEARCH_MAX_PER_PAGE'
  | 'TYPESENSE_ENABLED'
  | 'TYPESENSE_HOST'
  | 'TYPESENSE_PORT'
  | 'TYPESENSE_PROTOCOL'
  | 'TYPESENSE_ADMIN_KEY'
  | 'TYPESENSE_COLLECTION'
  | 'TYPESENSE_TIMEOUT_SECONDS'
  | 'SYNC_SECRET'
  | 'APP_URL'
  | 'POS_SCAN_API_KEYS'
  | 'FIREBASE_ENABLED'
  | 'FIREBASE_PROJECT_ID'
  | 'FIREBASE_CLIENT_EMAIL'
  | 'FIREBASE_PRIVATE_KEY'
  | 'FIREBASE_SERVICE_ACCOUNT_PATH'
  | 'FIREBASE_DATABASE_URL'
  | 'FIREBASE_STORAGE_BUCKET'
>;

type BuildServerEnv = ServerEnv & {
  searchIndex?: SearchIndex;
};

const scheduleCatalogRefresh = (app: Awaited<ReturnType<typeof Fastify>>, env: ServerEnv): void => {
  if (env.NODE_ENV === 'test') return;

  // Get PORT from environment or default
  const port = parseInt(process.env.PORT || '4000', 10);

  // Determine the correct base URL for internal calls
  const isProduction = env.NODE_ENV === 'production';
  const internalUrl = isProduction && env.APP_URL ? env.APP_URL : `http://localhost:${port}`;

  const getNextRefreshTime = (): number => {
    const now = new Date();
    const nowInUtc = now.getTime();

    // Bucharest is UTC+3, so 2 AM Bucharest = 23:00 UTC previous day
    let targetHour = 2 - 3; // 2 AM Bucharest - 3 = 23 UTC
    let targetDate = new Date(now);
    targetDate.setUTCHours(targetHour, 0, 0, 0);

    // If 23:00 UTC has passed today, target is tomorrow
    if (targetDate.getTime() <= nowInUtc) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    }

    return targetDate.getTime();
  };

  const scheduleNextRefresh = () => {
    const nextRefresh = getNextRefreshTime();
    const delayMs = nextRefresh - Date.now();
    const hoursUntilRefresh = Math.round(delayMs / (1000 * 60 * 60));

    app.log.info(`Catalog refresh scheduled in ${hoursUntilRefresh} hours (2 AM Bucharest time)`);

    setTimeout(async () => {
      try {
        app.log.info('Starting scheduled catalog refresh...');

        // Call the internal refresh endpoint
        const response = await fetch(`${internalUrl}/catalog/refresh`, {
          method: 'POST',
        });

        if (response.ok) {
          app.log.info('Scheduled catalog refresh completed successfully');
        } else {
          const errorText = await response.text();
          app.log.warn(
            { status: response.status, error: errorText },
            'Scheduled catalog refresh failed',
          );
        }
      } catch (error) {
        app.log.error({ err: error }, 'Scheduled catalog refresh error');
      } finally {
        // Schedule next refresh
        scheduleNextRefresh();
      }
    }, delayMs);
  };

  scheduleNextRefresh();
};

export const buildServer = async (env: BuildServerEnv) => {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
  });

  // Log 404 errors for debugging
  app.setNotFoundHandler((request, reply) => {
    app.log.warn({ url: request.url, method: request.method }, 'Route not found');
    reply.code(404).send({ error: 'Not Found', path: request.url });
  });

  const buildDefaultSearchIndex = (): SearchIndex =>
    createSearchIndex({
      enabled: env.TYPESENSE_ENABLED,
      ...(env.TYPESENSE_HOST ? { host: env.TYPESENSE_HOST } : {}),
      port: env.TYPESENSE_PORT,
      protocol: env.TYPESENSE_PROTOCOL,
      ...(env.TYPESENSE_ADMIN_KEY ? { adminKey: env.TYPESENSE_ADMIN_KEY } : {}),
      collectionName: env.TYPESENSE_COLLECTION,
      timeoutSeconds: env.TYPESENSE_TIMEOUT_SECONDS,
    });

  const searchIndex = env.searchIndex ?? buildDefaultSearchIndex();

  if (searchIndex.enabled) {
    void searchIndex.ensureCollection().catch((error) => {
      app.log.warn({ err: error }, 'Typesense collection bootstrap failed at startup');
    });
  }

  const allowAllOrigins = env.CORS_ALLOWED_ORIGINS.includes('*');

  app.register(cors, {
    origin: allowAllOrigins
      ? true
      : (origin, callback) => {
          if (!origin) {
            callback(null, true);
            return;
          }

          if (env.CORS_ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
            return;
          }

          callback(new Error('Origin is not allowed by CORS policy'), false);
        },
    credentials: false,
  });

  await app.register(rateLimit, {
    max: RATE_LIMIT_CONFIG.default.max,
    timeWindow: RATE_LIMIT_CONFIG.default.timeWindow,
  });

  app.register(healthRoutes);
  const firestore = createFirestoreClient({
    enabled: env.FIREBASE_ENABLED,
    ...(env.FIREBASE_PROJECT_ID ? { projectId: env.FIREBASE_PROJECT_ID } : {}),
    ...(env.FIREBASE_CLIENT_EMAIL ? { clientEmail: env.FIREBASE_CLIENT_EMAIL } : {}),
    ...(env.FIREBASE_PRIVATE_KEY ? { privateKey: env.FIREBASE_PRIVATE_KEY } : {}),
    ...(env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? { serviceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH }
      : {}),
    ...(env.FIREBASE_DATABASE_URL ? { databaseURL: env.FIREBASE_DATABASE_URL } : {}),
    ...(env.FIREBASE_STORAGE_BUCKET ? { storageBucket: env.FIREBASE_STORAGE_BUCKET } : {}),
  });

  const { initFirebaseAuth } = await import('./routes/utils.js');
  if (
    env.FIREBASE_ENABLED &&
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  ) {
    initFirebaseAuth(
      env.FIREBASE_PROJECT_ID,
      env.FIREBASE_CLIENT_EMAIL,
      env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    );
  }

  const catalogStore = createCatalogStore(firestore);
  const testCommerceStore = env.NODE_ENV === 'test' ? createInMemoryCommerceStore() : null;

  app.register(authRoutes, {
    ...(testCommerceStore ? { store: testCommerceStore } : { firestore }),
    loyaltySigningKey: env.LOYALTY_QR_SIGNING_KEY,
    posScanApiKeys: env.POS_SCAN_API_KEYS,
  });
  app.register(cartRoutes, {
    ...(testCommerceStore ? { store: testCommerceStore } : { firestore }),
    shopifyStoreDomain: env.SHOPIFY_STORE_DOMAIN,
    storefrontToken: env.SHOPIFY_STOREFRONT_TOKEN,
    loyaltySigningKey: env.LOYALTY_QR_SIGNING_KEY,
    posScanApiKeys: env.POS_SCAN_API_KEYS,
  });
  app.register(orderRoutes, {
    ...(testCommerceStore ? { store: testCommerceStore } : { firestore }),
  });
  app.register(loyaltyRoutes, {
    ...(testCommerceStore ? { store: testCommerceStore } : { firestore }),
    loyaltySigningKey: env.LOYALTY_QR_SIGNING_KEY,
    posScanApiKeys: env.POS_SCAN_API_KEYS,
  });
  app.register(accountRoutes, {
    ...(testCommerceStore ? { store: testCommerceStore } : { firestore }),
  });
  app.register(catalogRoutes, {
    catalogEnv: {
      shopifyStoreDomain: env.SHOPIFY_STORE_DOMAIN,
      storefrontToken: env.SHOPIFY_STOREFRONT_TOKEN,
      cacheTtlMs: env.CATALOG_CACHE_TTL_MS,
    },
    catalogStore,
  });

  app.register(searchRoutes, {
    searchIndex,
    searchEnv: {
      maxPerPage: env.SEARCH_MAX_PER_PAGE,
      syncSecret: env.SYNC_SECRET,
      shopifyStoreDomain: env.SHOPIFY_STORE_DOMAIN,
      shopifyAdminToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      webhookSecret: env.SHOPIFY_WEBHOOK_SECRET,
      ...(env.APP_URL ? { appUrl: env.APP_URL } : {}),
    },
  });

  scheduleCatalogRefresh(app, env);

  return app;
};

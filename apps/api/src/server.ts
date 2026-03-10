import cors from '@fastify/cors';
import Fastify from 'fastify';

import type { AppEnv } from './config/env.js';
import { catalogRoutes } from './routes/catalog.js';
import { healthRoutes } from './routes/health.js';

type ServerEnv = Pick<
  AppEnv,
  | 'NODE_ENV'
  | 'LOG_LEVEL'
  | 'CORS_ALLOWED_ORIGINS'
  | 'SHOPIFY_STORE_DOMAIN'
  | 'SHOPIFY_STOREFRONT_TOKEN'
  | 'CATALOG_CACHE_TTL_MS'
>;

export const buildServer = (env: ServerEnv) => {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
  });

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

  app.register(healthRoutes);
  app.register(catalogRoutes, {
    catalogEnv: {
      shopifyStoreDomain: env.SHOPIFY_STORE_DOMAIN,
      storefrontToken: env.SHOPIFY_STOREFRONT_TOKEN,
      cacheTtlMs: env.CATALOG_CACHE_TTL_MS,
    },
  });

  return app;
};


import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: logLevelSchema.default('info'),
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  CATALOG_CACHE_TTL_MS: z.coerce.number().int().min(1000).max(10 * 60 * 1000).default(60_000),
  SHOPIFY_STORE_DOMAIN: z.string().min(1),
  SHOPIFY_STOREFRONT_TOKEN: z.string().min(1),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1),
  LOYALTY_QR_SIGNING_KEY: z.string().min(32),
});

export type AppEnv = Omit<z.infer<typeof schema>, 'CORS_ALLOWED_ORIGINS'> & {
  CORS_ALLOWED_ORIGINS: string[];
};

export const loadEnv = (): AppEnv => {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const corsOrigins = parsed.data.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    ...parsed.data,
    CORS_ALLOWED_ORIGINS: corsOrigins.length > 0 ? corsOrigins : ['*'],
  };
};


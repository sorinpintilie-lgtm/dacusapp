import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const parseBooleanEnv = (value: unknown) => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return value;
};

const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: logLevelSchema.default('info'),
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  CATALOG_CACHE_TTL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(10 * 60 * 1000)
    .default(60_000),
  SEARCH_MAX_PER_PAGE: z.coerce.number().int().min(10).max(250).default(60),
  SHOPIFY_STORE_DOMAIN: z.string().min(1),
  SHOPIFY_STOREFRONT_TOKEN: z.string().min(1),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_WEBHOOK_SECRET: z.string().default(''),
  TYPESENSE_ENABLED: z.preprocess(parseBooleanEnv, z.boolean()).default(false),
  TYPESENSE_HOST: z.string().optional(),
  TYPESENSE_PORT: z.coerce.number().int().min(1).max(65535).default(443),
  TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('https'),
  TYPESENSE_ADMIN_KEY: z.string().optional(),
  TYPESENSE_COLLECTION: z.string().min(1).default('products'),
  TYPESENSE_TIMEOUT_SECONDS: z.coerce.number().int().min(2).max(30).default(5),
  SYNC_SECRET: z.string().default(''),
  APP_URL: z.string().url().optional(),
  LOYALTY_QR_SIGNING_KEY: z.string().min(32),
  POS_SCAN_API_KEYS: z.string().default(''),
  FIREBASE_ENABLED: z.preprocess(parseBooleanEnv, z.boolean()).default(false),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_DATABASE_URL: z.string().url().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  FIREBASE_EMULATOR_HOST: z.string().optional(),
  CARRIER_API_KEY: z.string().default(''),
  FAN_API_KEY: z.string().default(''),
  DPD_API_KEY: z.string().default(''),
  SAMEDAY_API_KEY: z.string().default(''),
});

export type AppEnv = Omit<z.infer<typeof schema>, 'CORS_ALLOWED_ORIGINS' | 'POS_SCAN_API_KEYS'> & {
  CORS_ALLOWED_ORIGINS: string[];
  POS_SCAN_API_KEYS: string[];
};

export const loadEnv = (): AppEnv => {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  if (parsed.data.TYPESENSE_ENABLED) {
    if (!parsed.data.TYPESENSE_HOST || parsed.data.TYPESENSE_HOST.trim().length === 0) {
      throw new Error(
        'Invalid environment configuration: TYPESENSE_HOST is required when TYPESENSE_ENABLED=true',
      );
    }

    if (!parsed.data.TYPESENSE_ADMIN_KEY || parsed.data.TYPESENSE_ADMIN_KEY.trim().length === 0) {
      throw new Error(
        'Invalid environment configuration: TYPESENSE_ADMIN_KEY is required when TYPESENSE_ENABLED=true',
      );
    }
  }

  const corsOrigins = parsed.data.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const posScanApiKeys = parsed.data.POS_SCAN_API_KEYS.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    ...parsed.data,
    CORS_ALLOWED_ORIGINS: corsOrigins.length > 0 ? corsOrigins : ['*'],
    POS_SCAN_API_KEYS: posScanApiKeys,
  };
};

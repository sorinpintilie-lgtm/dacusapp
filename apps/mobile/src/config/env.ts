import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z
    .string()
    .url()
    .default('https://us-central1-dacus-b40f9.cloudfunctions.net/api'),
  EXPO_PUBLIC_API_BASE_URL_DEVICE: z.string().url().optional(),
  EXPO_PUBLIC_STORE_DOMAIN: z.string().optional(),
  EXPO_PUBLIC_PUBLIC_TOKEN: z.string().optional(),
  EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: z.string().default('f4eb2c-ae.myshopify.com'),
  EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN: z.string().default(''),
  EXPO_PUBLIC_SHOPIFY_AUTH_CLIENT_ID: z.string().default('not-configured'),
  EXPO_PUBLIC_SHOPIFY_AUTH_AUTHORIZE_URL: z
    .string()
    .url()
    .default('https://client.dacus.ro/authentication/oauth/authorize'),
  EXPO_PUBLIC_SHOPIFY_AUTH_TOKEN_URL: z
    .string()
    .url()
    .default('https://client.dacus.ro/authentication/oauth/token'),
  EXPO_PUBLIC_SHOPIFY_AUTH_LOGOUT_URL: z
    .string()
    .url()
    .default('https://client.dacus.ro/authentication/logout'),
  EXPO_PUBLIC_STOREFRONT_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  EXPO_PUBLIC_STOREFRONT_RETRY_COUNT: z.coerce.number().int().min(0).max(5).default(2),
  EXPO_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  EXPO_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  console.warn(`Invalid mobile environment configuration: ${details}`);
}

const data = parsed.success
  ? parsed.data
  : {
      EXPO_PUBLIC_API_BASE_URL: 'https://us-central1-dacus-b40f9.cloudfunctions.net/api',
      EXPO_PUBLIC_API_BASE_URL_DEVICE: undefined,
      EXPO_PUBLIC_STORE_DOMAIN: undefined,
      EXPO_PUBLIC_PUBLIC_TOKEN: undefined,
      EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN: 'f4eb2c-ae.myshopify.com',
      EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN: '',
      EXPO_PUBLIC_SHOPIFY_AUTH_CLIENT_ID: 'not-configured',
      EXPO_PUBLIC_SHOPIFY_AUTH_AUTHORIZE_URL:
        'https://client.dacus.ro/authentication/oauth/authorize',
      EXPO_PUBLIC_SHOPIFY_AUTH_TOKEN_URL: 'https://client.dacus.ro/authentication/oauth/token',
      EXPO_PUBLIC_SHOPIFY_AUTH_LOGOUT_URL: 'https://client.dacus.ro/authentication/logout',
      EXPO_PUBLIC_STOREFRONT_TIMEOUT_MS: 12000,
      EXPO_PUBLIC_STOREFRONT_RETRY_COUNT: 2,
    };

export const mobileEnv = {
  apiBaseUrl: data.EXPO_PUBLIC_API_BASE_URL,
  apiBaseUrlDevice: data.EXPO_PUBLIC_API_BASE_URL_DEVICE,
  shopifyStoreDomain: data.EXPO_PUBLIC_STORE_DOMAIN || data.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN,
  storefrontPublicToken:
    data.EXPO_PUBLIC_PUBLIC_TOKEN || data.EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
  authClientId: data.EXPO_PUBLIC_SHOPIFY_AUTH_CLIENT_ID,
  authAuthorizeUrl: data.EXPO_PUBLIC_SHOPIFY_AUTH_AUTHORIZE_URL,
  authTokenUrl: data.EXPO_PUBLIC_SHOPIFY_AUTH_TOKEN_URL,
  authLogoutUrl: data.EXPO_PUBLIC_SHOPIFY_AUTH_LOGOUT_URL,
  storefrontTimeoutMs: data.EXPO_PUBLIC_STOREFRONT_TIMEOUT_MS,
  storefrontRetryCount: data.EXPO_PUBLIC_STOREFRONT_RETRY_COUNT,
  firebaseApiKey: data.EXPO_PUBLIC_FIREBASE_API_KEY,
  firebaseAuthDomain: data.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  firebaseProjectId: data.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  firebaseStorageBucket: data.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  firebaseMessagingSenderId: data.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  firebaseAppId: data.EXPO_PUBLIC_FIREBASE_APP_ID,
};

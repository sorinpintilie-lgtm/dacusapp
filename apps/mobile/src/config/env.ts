import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  EXPO_PUBLIC_SHOPIFY_AUTH_CLIENT_ID: z.string().min(1),
  EXPO_PUBLIC_SHOPIFY_AUTH_AUTHORIZE_URL: z.string().url(),
  EXPO_PUBLIC_SHOPIFY_AUTH_TOKEN_URL: z.string().url(),
  EXPO_PUBLIC_SHOPIFY_AUTH_LOGOUT_URL: z.string().url(),
  EXPO_PUBLIC_STOREFRONT_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  EXPO_PUBLIC_STOREFRONT_RETRY_COUNT: z.coerce.number().int().min(0).max(5).default(2),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid mobile environment configuration: ${details}`);
}

export const mobileEnv = {
  apiBaseUrl: parsed.data.EXPO_PUBLIC_API_BASE_URL,
  authClientId: parsed.data.EXPO_PUBLIC_SHOPIFY_AUTH_CLIENT_ID,
  authAuthorizeUrl: parsed.data.EXPO_PUBLIC_SHOPIFY_AUTH_AUTHORIZE_URL,
  authTokenUrl: parsed.data.EXPO_PUBLIC_SHOPIFY_AUTH_TOKEN_URL,
  authLogoutUrl: parsed.data.EXPO_PUBLIC_SHOPIFY_AUTH_LOGOUT_URL,
  storefrontTimeoutMs: parsed.data.EXPO_PUBLIC_STOREFRONT_TIMEOUT_MS,
  storefrontRetryCount: parsed.data.EXPO_PUBLIC_STOREFRONT_RETRY_COUNT,
};


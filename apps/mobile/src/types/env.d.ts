declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_API_BASE_URL_DEVICE?: string;
    EXPO_PUBLIC_STORE_DOMAIN?: string;
    EXPO_PUBLIC_PUBLIC_TOKEN?: string;
    EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN?: string;
    EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN?: string;
    EXPO_PUBLIC_SHOPIFY_AUTH_CLIENT_ID?: string;
    EXPO_PUBLIC_SHOPIFY_AUTH_AUTHORIZE_URL?: string;
    EXPO_PUBLIC_SHOPIFY_AUTH_TOKEN_URL?: string;
    EXPO_PUBLIC_SHOPIFY_AUTH_LOGOUT_URL?: string;
    EXPO_PUBLIC_STOREFRONT_TIMEOUT_MS?: string;
    EXPO_PUBLIC_STOREFRONT_RETRY_COUNT?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};

declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.PNG' {
  const value: number;
  export default value;
}

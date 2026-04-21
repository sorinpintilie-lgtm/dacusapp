import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

type RegisterResult = {
  sessionToken: string;
  email: string;
  password: string;
  name: string;
};

describe('account settings routes', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let primaryUser: RegisterResult;

  const registerUser = async (suffix: string): Promise<RegisterResult> => {
    const email = `settings-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const password = 'password123';
    const name = `Settings ${suffix}`;

    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password,
        name,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { sessionToken: string };
    return { sessionToken: payload.sessionToken, email, password, name };
  };

  beforeAll(async () => {
    app = await buildServer({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      CORS_ALLOWED_ORIGINS: ['*'],
      LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-account-settings',
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
    primaryUser = await registerUser('primary');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthorized account settings access', async () => {
    const getResponse = await app.inject({
      method: 'GET',
      url: '/account/settings',
    });
    expect(getResponse.statusCode).toBe(401);

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: '/account/settings',
      payload: {
        security: { loginAlerts: false },
      },
    });
    expect(patchResponse.statusCode).toBe(401);
  });

  it('returns default settings for authenticated users', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/account/settings',
      headers: {
        'x-session-token': primaryUser.sessionToken,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      settings: {
        notifications: { push: { backInStock?: boolean } };
        security: { loginAlerts: boolean; twoFactorEnabled: boolean };
        profile: { displayName: string; locale: string };
        schemaVersion: number;
      };
    };

    expect(payload.settings.notifications.push.backInStock).toBe(true);
    expect(payload.settings.security.loginAlerts).toBe(true);
    expect(payload.settings.security.twoFactorEnabled).toBe(false);
    expect(payload.settings.profile.displayName).toBe(primaryUser.name);
    expect(payload.settings.profile.locale).toBe('ro-RO');
    expect(payload.settings.schemaVersion).toBe(1);
  });

  it('merges partial settings patch and persists changes', async () => {
    const patchResponse = await app.inject({
      method: 'PATCH',
      url: '/account/settings',
      headers: {
        'x-session-token': primaryUser.sessionToken,
      },
      payload: {
        notifications: {
          email: {
            marketing: false,
          },
        },
        profile: {
          locale: 'en-GB',
        },
      },
    });

    expect(patchResponse.statusCode).toBe(200);
    const patchPayload = patchResponse.json() as {
      settings: {
        notifications: {
          email: { marketing: boolean; orderUpdates: boolean; securityAlerts: boolean };
        };
        profile: { locale: string };
      };
    };
    expect(patchPayload.settings.notifications.email.marketing).toBe(false);
    expect(patchPayload.settings.notifications.email.orderUpdates).toBe(true);
    expect(patchPayload.settings.notifications.email.securityAlerts).toBe(true);
    expect(patchPayload.settings.profile.locale).toBe('en-GB');

    const getResponse = await app.inject({
      method: 'GET',
      url: '/account/settings',
      headers: {
        'x-session-token': primaryUser.sessionToken,
      },
    });

    expect(getResponse.statusCode).toBe(200);
    const getPayload = getResponse.json() as {
      settings: {
        notifications: { email: { marketing: boolean; orderUpdates: boolean } };
        profile: { locale: string };
      };
    };
    expect(getPayload.settings.notifications.email.marketing).toBe(false);
    expect(getPayload.settings.notifications.email.orderUpdates).toBe(true);
    expect(getPayload.settings.profile.locale).toBe('en-GB');
  });

  it('accepts consent source and timestamp updates', async () => {
    const consentTimestamp = '2026-02-10T08:30:00.000Z';
    const response = await app.inject({
      method: 'PATCH',
      url: '/account/settings',
      headers: {
        'x-session-token': primaryUser.sessionToken,
      },
      payload: {
        privacy: {
          analyticsConsent: {
            granted: true,
            updatedAt: consentTimestamp,
            source: 'privacy-center',
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      settings: {
        privacy: {
          analyticsConsent: { granted: boolean; updatedAt: string; source: string };
        };
      };
    };

    expect(payload.settings.privacy.analyticsConsent.granted).toBe(true);
    expect(payload.settings.privacy.analyticsConsent.updatedAt).toBe(consentTimestamp);
    expect(payload.settings.privacy.analyticsConsent.source).toBe('privacy-center');
  });

  it('changes password and invalidates old credentials', async () => {
    const passwordUser = await registerUser('password');

    const wrongCurrentResponse = await app.inject({
      method: 'POST',
      url: '/account/security/change-password',
      headers: {
        'x-session-token': passwordUser.sessionToken,
      },
      payload: {
        currentPassword: 'wrong-password',
        newPassword: 'new-password-123',
      },
    });
    expect(wrongCurrentResponse.statusCode).toBe(401);

    const successResponse = await app.inject({
      method: 'POST',
      url: '/account/security/change-password',
      headers: {
        'x-session-token': passwordUser.sessionToken,
      },
      payload: {
        currentPassword: passwordUser.password,
        newPassword: 'new-password-123',
      },
    });
    expect(successResponse.statusCode).toBe(200);

    const oldPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: passwordUser.email,
        password: passwordUser.password,
      },
    });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: passwordUser.email,
        password: 'new-password-123',
      },
    });
    expect(newPasswordLogin.statusCode).toBe(200);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../src/server.js';

let app: Awaited<ReturnType<typeof buildServer>>;

const initApp = async () => {
  app = await buildServer({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  CORS_ALLOWED_ORIGINS: ['*'],
  LOYALTY_QR_SIGNING_KEY: 'test-signing-key-for-loyalty-scan-routes-1234567890',
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
  POS_SCAN_API_KEYS: ['pos-secret-key'],
  FIREBASE_ENABLED: false,
});
};

const registerUser = async () => {
  const email = `scan-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      password: 'password123',
      name: 'Scan User',
    },
  });

  expect(response.statusCode).toBe(200);
  const payload = response.json() as { sessionToken: string };
  return payload.sessionToken;
};

const fetchLoyaltyQrToken = async (sessionToken: string) => {
  const response = await app.inject({
    method: 'POST',
    url: '/loyalty/qr',
    headers: {
      'x-session-token': sessionToken,
    },
  });

  expect(response.statusCode).toBe(200);
  const payload = response.json() as { qrToken: string };
  return payload.qrToken;
};

describe('commerce loyalty POS scan routes', () => {
  beforeAll(async () => {
    await initApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('awards points from in-store scan and prevents receipt replay', async () => {
    const sessionToken = await registerUser();
    const qrToken = await fetchLoyaltyQrToken(sessionToken);

    const firstScan = await app.inject({
      method: 'POST',
      url: '/loyalty/scan',
      headers: {
        'x-pos-api-key': 'pos-secret-key',
      },
      payload: {
        qrToken,
        receiptId: 'BON-1001',
        totalRon: 259.99,
        storeId: 'store-1',
        terminalId: 'terminal-1',
      },
    });

    expect(firstScan.statusCode).toBe(200);
    const firstPayload = firstScan.json() as {
      duplicated: boolean;
      pointsAdded: number;
      summary: { points: number };
    };
    expect(firstPayload.duplicated).toBe(false);
    expect(firstPayload.pointsAdded).toBe(259);
    expect(firstPayload.summary.points).toBe(259);

    const replayScan = await app.inject({
      method: 'POST',
      url: '/loyalty/scan',
      headers: {
        'x-pos-api-key': 'pos-secret-key',
      },
      payload: {
        qrToken,
        receiptId: 'BON-1001',
        totalRon: 259.99,
      },
    });

    expect(replayScan.statusCode).toBe(200);
    const replayPayload = replayScan.json() as {
      duplicated: boolean;
      pointsAdded: number;
      summary: { points: number };
    };
    expect(replayPayload.duplicated).toBe(true);
    expect(replayPayload.pointsAdded).toBe(0);
    expect(replayPayload.summary.points).toBe(259);
  });

  it('rejects unauthorized POS scan requests', async () => {
    const unauthorized = await app.inject({
      method: 'POST',
      url: '/loyalty/scan',
      payload: {
        qrToken: 'invalid',
        receiptId: 'BON-UNAUTH',
        totalRon: 100,
      },
    });

    expect(unauthorized.statusCode).toBe(401);

    const wrongKey = await app.inject({
      method: 'POST',
      url: '/loyalty/scan',
      headers: {
        'x-pos-api-key': 'wrong-key',
      },
      payload: {
        qrToken: 'invalid',
        receiptId: 'BON-UNAUTH-2',
        totalRon: 100,
      },
    });

    expect(wrongKey.statusCode).toBe(401);
  });

  it('rejects invalid qr tokens', async () => {
    const invalidToken = await app.inject({
      method: 'POST',
      url: '/loyalty/scan',
      headers: {
        'x-pos-api-key': 'pos-secret-key',
      },
      payload: {
        qrToken: 'this-is-not-a-valid-token',
        receiptId: 'BON-INVALID',
        totalRon: 100,
      },
    });

    expect(invalidToken.statusCode).toBe(400);
  });

  it('redeems voucher token via POS and prevents duplicate voucher redemption', async () => {
    const sessionToken = await registerUser();
    const qrToken = await fetchLoyaltyQrToken(sessionToken);

    const earnPoints = await app.inject({
      method: 'POST',
      url: '/loyalty/scan',
      headers: {
        'x-pos-api-key': 'pos-secret-key',
      },
      payload: {
        qrToken,
        receiptId: 'BON-2001',
        totalRon: 250,
      },
    });
    expect(earnPoints.statusCode).toBe(200);

    const redeem = await app.inject({
      method: 'POST',
      url: '/loyalty/redeem',
      headers: {
        'x-session-token': sessionToken,
      },
      payload: {
        points: 200,
      },
    });

    expect(redeem.statusCode).toBe(200);
    const redeemPayload = redeem.json() as { voucher: { code: string; valueRon: number; qrToken: string } };

    const firstVoucherScan = await app.inject({
      method: 'POST',
      url: '/loyalty/voucher/redeem-scan',
      headers: {
        'x-pos-api-key': 'pos-secret-key',
      },
      payload: {
        qrToken: redeemPayload.voucher.qrToken,
        receiptId: 'BON-2002',
        storeId: 'store-1',
        terminalId: 'terminal-7',
      },
    });

    expect(firstVoucherScan.statusCode).toBe(200);
    const firstVoucherPayload = firstVoucherScan.json() as {
      duplicated: boolean;
      voucherCode: string;
      valueRon: number;
    };
    expect(firstVoucherPayload.duplicated).toBe(false);
    expect(firstVoucherPayload.voucherCode).toBe(redeemPayload.voucher.code);
    expect(firstVoucherPayload.valueRon).toBe(redeemPayload.voucher.valueRon);

    const duplicateVoucherScan = await app.inject({
      method: 'POST',
      url: '/loyalty/voucher/redeem-scan',
      headers: {
        'x-pos-api-key': 'pos-secret-key',
      },
      payload: {
        qrToken: redeemPayload.voucher.qrToken,
        receiptId: 'BON-2003',
      },
    });

    expect(duplicateVoucherScan.statusCode).toBe(200);
    const duplicateVoucherPayload = duplicateVoucherScan.json() as {
      duplicated: boolean;
      voucherCode: string;
      valueRon: number;
    };
    expect(duplicateVoucherPayload.duplicated).toBe(true);
    expect(duplicateVoucherPayload.voucherCode).toBe(redeemPayload.voucher.code);
    expect(duplicateVoucherPayload.valueRon).toBe(redeemPayload.voucher.valueRon);
  });
});

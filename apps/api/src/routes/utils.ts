import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import type { CommerceStore } from '../services/commerceStore.js';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const hashPassword = (password: string) => {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
};

export const verifyPassword = (password: string, stored: string) => {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};

export const parseSessionToken = (headers: Record<string, unknown>): string | null => {
  const headerToken =
    typeof headers['x-session-token'] === 'string' ? headers['x-session-token'] : null;
  if (headerToken && headerToken.length > 0) return headerToken;

  const authorization = typeof headers.authorization === 'string' ? headers.authorization : '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  return null;
};

export const POINTS_PER_RON = 1;
export const VOUCHER_EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionContext = {
  token: string;
  session: { userId: string; createdAt: string };
  user: { id: string; email: string; name: string; createdAt: string; passwordHash?: string };
};

export const getSessionContext = async (
  store: CommerceStore,
  headers: Record<string, unknown>,
): Promise<SessionContext | null> => {
  const token = parseSessionToken(headers);
  if (!token) return null;
  const session = await store.getSessionByToken(token);
  if (!session) return null;
  if (Date.now() - Date.parse(session.createdAt) > SESSION_MAX_AGE_MS) {
    await store.deleteSession(token);
    return null;
  }
  const user = await store.getUserById(session.userId);
  if (!user) return null;
  return { token, session, user };
};

export const normalizeUnitPriceRon = (value: unknown): number | null => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Number(amount.toFixed(2));
};

export const computeCheckoutTotal = (lines: { unitPriceRon?: number | null; quantity: number }[]) =>
  Number(
    lines
      .reduce(
        (sum, line) =>
          sum + (normalizeUnitPriceRon(line.unitPriceRon) ?? 0) * Math.max(0, line.quantity),
        0,
      )
      .toFixed(2),
  );

export const buildSignedQrToken = (signingKey: string, payload: Record<string, unknown>) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', signingKey).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

export const buildUnsignedToken = (payload: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

export const buildAuthError = (code: string, error: string, errorRo: string) => ({
  code,
  error,
  errorRo,
});

export const parseSignedOrUnsignedToken = (
  token: string,
  signingKey?: string,
): { payload: Record<string, unknown>; isSigned: boolean } | null => {
  const value = token.trim();
  if (!value) return null;

  const signedParts = value.split('.');
  if (signedParts.length === 2) {
    const [encodedPayload, signature] = signedParts;
    if (!encodedPayload || !signature || !signingKey) return null;
    const expected = createHmac('sha256', signingKey).update(encodedPayload).digest('base64url');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    )
      return null;

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
      return { payload, isSigned: true };
    } catch {
      return null;
    }
  }

  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    return { payload, isSigned: false };
  } catch {
    return null;
  }
};

export const isPosAuthorized = (headers: Record<string, unknown>, allowedKeys: string[]) => {
  const provided =
    typeof headers['x-pos-api-key'] === 'string' ? headers['x-pos-api-key'].trim() : '';
  if (!provided || allowedKeys.length === 0) return false;

  return allowedKeys.some((value) => {
    const expected = Buffer.from(value, 'utf8');
    const actual = Buffer.from(provided, 'utf8');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
};

export type AddressDraft = {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  countryCode: string;
};

export const parseAddressDraft = (body: unknown): AddressDraft | null => {
  const input = (body ?? {}) as Record<string, unknown>;
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const line1 = typeof input.line1 === 'string' ? input.line1.trim() : '';
  const line2 = typeof input.line2 === 'string' ? input.line2.trim() : '';
  const city = typeof input.city === 'string' ? input.city.trim() : '';
  const county = typeof input.county === 'string' ? input.county.trim() : '';
  const postalCode = typeof input.postalCode === 'string' ? input.postalCode.trim() : '';
  const countryCodeRaw =
    typeof input.countryCode === 'string' ? input.countryCode.trim().toUpperCase() : '';
  const countryCode = countryCodeRaw.length === 2 ? countryCodeRaw : '';

  if (!label || !fullName || !phone || !line1 || !city || !county || !postalCode || !countryCode) {
    return null;
  }

  return {
    label,
    fullName,
    phone,
    line1,
    ...(line2 ? { line2 } : {}),
    city,
    county,
    postalCode,
    countryCode,
  };
};

import { randomBytes, randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import { createCommerceStore, type CommerceStore } from '../services/commerceStore.js';
import {
  buildAuthError,
  buildSignedQrToken,
  buildUnsignedToken,
  getSessionContext,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from './utils.js';

type AuthRoutesOptions = {
  store?: CommerceStore;
  firestore?: Firestore | null;
  loyaltySigningKey?: string;
  posScanApiKeys?: string[];
};

const addNotification = async (
  store: CommerceStore,
  userId: string,
  title: string,
  message: string,
) => {
  const current = await store.getNotifications(userId);
  current.unshift({
    id: randomUUID(),
    userId,
    title,
    message,
    createdAt: new Date().toISOString(),
  });
  await store.setNotifications(userId, current.slice(0, 100));
};

const sanitizeUser = (user: { id: string; email: string; name: string; createdAt: string }) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt,
});

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, options) => {
  const store = options.store ?? createCommerceStore(options.firestore ?? null);

  fastify.post(
    '/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      request.log.info('auth/register handler start');
      const body = (request.body ?? {}) as { email?: string; password?: string; name?: string };
      const email = normalizeEmail(body.email ?? '');
      const password = (body.password ?? '').trim();
      const name = (body.name ?? '').trim() || 'Client Dacus';

      if (!email || !password || password.length < 6) {
        reply.code(400);
        return buildAuthError(
          'auth/invalid-input',
          'Email and password (min 6 chars) are required.',
          'Emailul și parola sunt obligatorii (minim 6 caractere).',
        );
      }

      const existing = await store.getUserByEmail(email);
      request.log.info({ email }, 'auth/register lookup completed');
      if (existing) {
        reply.code(409);
        return buildAuthError(
          'auth/account-exists',
          'Account already exists.',
          'Există deja un cont cu acest email.',
        );
      }

      const user = await store.createUser({ email, passwordHash: hashPassword(password), name });
      request.log.info({ userId: user.id }, 'auth/register user created');

      const session = await store.createSession(user.id);
      request.log.info({ userId: user.id }, 'auth/register session created');
      await addNotification(
        store,
        user.id,
        'Bine ai venit!',
        'Contul tău Dacus.ro a fost creat cu succes.',
      );
      request.log.info({ userId: user.id }, 'auth/register notification added');

      const loyaltyIssuedAt = new Date().toISOString();
      const loyaltyPayload = {
        type: 'loyalty-member',
        sub: user.id,
        email: user.email,
        issuedAt: loyaltyIssuedAt,
        nonce: randomBytes(8).toString('hex'),
      };
      const loyaltyQrToken = options.loyaltySigningKey
        ? buildSignedQrToken(options.loyaltySigningKey, loyaltyPayload)
        : buildUnsignedToken(loyaltyPayload);
      await store.setLoyaltyProfile(user.id, {
        redeemedPoints: 0,
        loyaltyQrToken,
        loyaltyQrCreatedAt: loyaltyIssuedAt,
      });

      return { sessionToken: session.token, user: sanitizeUser(user) };
    },
  );

  fastify.post(
    '/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      request.log.info('auth/login handler start');
      const body = (request.body ?? {}) as { email?: string; password?: string };
      const email = normalizeEmail(body.email ?? '');
      const password = (body.password ?? '').trim();
      const user = await store.getUserByEmail(email);
      request.log.info({ email, found: !!user }, 'auth/login lookup completed');

      if (!user || !verifyPassword(password, user.passwordHash)) {
        reply.code(401);
        return buildAuthError(
          'auth/invalid-credentials',
          'Invalid credentials.',
          'Email sau parolă incorectă.',
        );
      }

      const session = await store.createSession(user.id);
      request.log.info({ userId: user.id }, 'auth/login session created');

      return { sessionToken: session.token, user: sanitizeUser(user) };
    },
  );

  fastify.post('/auth/logout', async (request) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (sessionCtx) {
      await store.deleteSession(sessionCtx.token);
    }
    return { ok: true };
  });

  fastify.get('/auth/session', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return buildAuthError(
        'auth/unauthorized',
        'Unauthorized.',
        'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
      );
    }

    return { user: sanitizeUser(sessionCtx.user), sessionCreatedAt: sessionCtx.session.createdAt };
  });

  fastify.post('/auth/reset-password-request', async (request) => {
    const body = (request.body ?? {}) as { email?: string };
    const email = normalizeEmail(body.email ?? '');

    if (!email) {
      return {
        ok: true,
        message: 'Dacă emailul există în sistem, vei primi instrucțiuni de resetare.',
      };
    }

    const user = await store.getUserByEmail(email);

    return {
      ok: true,
      message: 'Dacă emailul există în sistem, vei primi instrucțiuni de resetare.',
      ...(user ? { requestToken: `reset_${randomBytes(10).toString('hex')}` } : {}),
    };
  });

  fastify.get('/auth/purpose', async () => ({
    purpose: {
      login: 'Autentifică utilizatorul existent și creează sesiunea pe dispozitiv.',
      register:
        'Creează cont nou, persistat în Firebase Firestore, și pornește sesiunea utilizatorului.',
      session: 'Verifică dacă sesiunea curentă este validă și returnează datele utilizatorului.',
      logout: 'Închide sesiunea activă pentru dispozitivul curent.',
      resetPassword: 'Trimite instrucțiuni de resetare, dacă adresa există în sistem.',
    },
  }));
};

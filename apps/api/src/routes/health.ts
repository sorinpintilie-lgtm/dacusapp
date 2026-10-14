import type { FastifyPluginAsync } from 'fastify';

type HealthOptions = {
  /** Where accounts, carts and orders are kept. 'memory' loses them on every restart. */
  storage?: 'firestore' | 'memory';
  /** Whether Firebase ID tokens (app logins) are verified. */
  auth?: 'firebase' | 'off';
};

export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (fastify, options) => {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'dacus-loyalty-api',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      ...(options.storage ? { storage: options.storage } : {}),
      ...(options.auth ? { auth: options.auth } : {}),
    };
  });
};

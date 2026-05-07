import type { FastifyPluginAsync } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import { createCommerceStore, createInMemoryCommerceStore, type CommerceStore } from '../services/commerceStore.js';
import { getSessionContext } from './utils.js';

type OrderRoutesOptions = {
  store?: CommerceStore;
  firestore?: Firestore | null;
};

export const orderRoutes: FastifyPluginAsync<OrderRoutesOptions> = async (fastify, options) => {
  const store = options.store ?? (options.firestore ? createCommerceStore(options.firestore) : createInMemoryCommerceStore());

  fastify.get('/orders', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }
    return { orders: await store.getOrders(sessionCtx.user.id) };
  });

  fastify.get('/orders/:orderId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { orderId?: string };
    const orderId = (params.orderId ?? '').trim();
    if (!orderId) {
      reply.code(400);
      return { error: 'Order id is required.' };
    }

    const orders = await store.getOrders(sessionCtx.user.id);
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      reply.code(404);
      return { error: 'Order not found.' };
    }

    const addresses = await store.getAddresses(sessionCtx.user.id);
    const address = order.addressId ? addresses.find((item) => item.id === order.addressId) : null;
    return { order, ...(address ? { address } : {}) };
  });
};

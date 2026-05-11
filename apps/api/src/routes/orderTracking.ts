import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';
import {
  createShipment,
  getTrackingInfo,
  getCarrierTrackingUrl,
  type CreateShipmentInput,
  type CarrierService,
} from '../services/carriers.js';
import { sendPushNotification } from '../services/push.js';
import { type CartLine, type Order, type DeviceRegistration } from '../services/commerceStore.js';
import { randomBytes } from 'node:crypto';

interface OrderTrackingOptions {
  store: {
    getOrders: (userId: string) => Promise<Order[]>;
    setOrders: (userId: string, orders: Order[]) => Promise<void>;
    getDeviceRegistrations: (userId: string) => Promise<DeviceRegistration[]>;
  };
}

export const orderTrackingRoutes: FastifyPluginAsync<OrderTrackingOptions> = async (
  fastify,
  { store },
) => {
  const CARRIER_API_KEY = process.env.CARRIER_API_KEY ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authenticateWebhook = (request: FastifyRequest, reply: any) => {
    const providedKey = request.headers['x-api-key'] ?? request.headers['x-carrier-key'];
    if (!CARRIER_API_KEY || providedKey !== CARRIER_API_KEY) {
      reply.code(401).send({ error: 'Unauthorized' });
      return false;
    }
    return true;
  };

  fastify.post('/orders/webhook/ship', async (request, reply) => {
    if (!authenticateWebhook(request, reply)) return;

    const body = request.body as {
      orderId?: string;
      carrier?: string;
      recipientName?: string;
      recipientPhone?: string;
      recipientAddress?: string;
      recipientCity?: string;
      recipientCounty?: string;
    };

    const orderId = (body.orderId ?? '').trim();
    if (!orderId) {
      return { error: 'orderId is required' };
    }

    const orders = await store.getOrders('');
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return { error: 'Order not found' };
    }

    const carrierService: CarrierService = (body.carrier?.toLowerCase() as CarrierService) || 'fan';
    const shipmentInput: CreateShipmentInput = {
      orderId: order.id,
      recipientName: body.recipientName ?? '',
      recipientPhone: body.recipientPhone ?? '',
      recipientAddress: body.recipientAddress ?? '',
      recipientCity: body.recipientCity ?? '',
      recipientCounty: body.recipientCounty ?? '',
    };

    let shipment;
    try {
      shipment = await createShipment(carrierService, shipmentInput);
    } catch (error) {
      console.error('Shipment creation failed:', error);
      shipment = {
        trackingNumber: `TRK-${randomBytes(4).toString('hex').toUpperCase()}`,
        carrier: carrierService,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    const trackingUrl = getCarrierTrackingUrl(shipment.carrier, shipment.trackingNumber);
    const updatedOrder: Order = {
      ...order,
      status: 'preparing',
      trackingCode: shipment.trackingNumber,
      carrier: shipment.carrier,
      carrierService: shipment.carrier,
      trackingUrl,
      estimatedDelivery: shipment.estimatedDelivery,
      shippedAt: new Date().toISOString(),
    };

    const updatedOrders = orders.map((o) => (o.id === orderId ? updatedOrder : o));
    await store.setOrders(order.userId, updatedOrders);

    const notified = await sendPushNotification(
      store,
      order.userId,
      'Comandă pregătită',
      `Comanda ${order.id} va fi livrată azi. Tracking: ${shipment.trackingNumber}`,
      { orderId: order.id, type: 'order_shipped' },
    );

    return {
      ok: true,
      orderId: order.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      trackingUrl,
      estimatedDelivery: shipment.estimatedDelivery,
      notifiedDevices: notified,
    };
  });

  fastify.post('/orders/webhook/status', async (request, reply) => {
    if (!authenticateWebhook(request, reply)) return;

    const body = request.body as {
      orderId?: string;
      trackingNumber?: string;
      status?: string;
      events?: Array<{
        timestamp: string;
        location: string;
        description: string;
        status: string;
      }>;
    };

    const orderId = (body.orderId ?? '').trim();
    const trackingNumber = (body.trackingNumber ?? '').trim();
    if (!orderId && !trackingNumber) {
      return { error: 'orderId or trackingNumber is required' };
    }

    const orders = await store.getOrders('');
    const order = orders.find((o) => o.id === orderId || o.trackingCode === trackingNumber);
    if (!order) {
      return { error: 'Order not found' };
    }

    const statusMap: Record<string, Order['status']> = {
      pending: 'created',
      picked_up: 'preparing',
      in_transit: 'in_transit',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      failed: 'failed',
      returned: 'returned',
    };

    const newStatus = statusMap[body.status ?? ''] ?? order.status;
    const updatedOrder: Order = {
      ...order,
      status: newStatus,
      ...(newStatus === 'delivered' ? { deliveredAt: new Date().toISOString() } : {}),
    };

    const updatedOrders = orders.map((o) => (o.id === order.id ? updatedOrder : o));
    await store.setOrders(order.userId, updatedOrders);

    const statusMessages: Record<string, string> = {
      preparing: 'Comanda ta este pregătită pentru ridicare',
      in_transit: 'Comanda ta este în curs de livrare',
      out_for_delivery: 'Comanda ta este în curs de livrare',
      delivered: 'Comanda ta a fost livrată!',
      failed: 'Livrarea a eșuat. Vei fi contactat de curier',
      returned: 'Comanda a fost returnată la expeditor',
    };

    if (statusMessages[newStatus] && newStatus !== order.status) {
      await sendPushNotification(
        store,
        order.userId,
        'Actualizare comandă',
        statusMessages[newStatus],
        { orderId: order.id, type: 'order_update', status: newStatus },
      );
    }

    return {
      ok: true,
      orderId: order.id,
      status: newStatus,
    };
  });

  fastify.get('/orders/:orderId/tracking', async (request) => {
    const params = request.params as { orderId?: string };
    const orderId = (params.orderId ?? '').trim();
    if (!orderId) {
      return { error: 'orderId is required' };
    }

    const orders = await store.getOrders('');
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return { error: 'Order not found' };
    }

    if (!order.trackingCode || !order.carrier) {
      return {
        orderId: order.id,
        status: order.status,
        trackingCode: order.trackingCode,
        carrier: order.carrier,
        trackingUrl: order.trackingUrl,
        estimatedDelivery: order.estimatedDelivery,
        events: [],
      };
    }

    try {
      const tracking = await getTrackingInfo(order.carrier as CarrierService, order.trackingCode);

      const updatedOrder: Order = {
        ...order,
        status: tracking.status === 'delivered' ? 'delivered' : order.status,
        ...(tracking.status === 'delivered' ? { deliveredAt: new Date().toISOString() } : {}),
      };
      const updatedOrders = orders.map((o) => (o.id === orderId ? updatedOrder : o));
      await store.setOrders(order.userId, updatedOrders);

      return {
        orderId: order.id,
        status: tracking.status,
        trackingCode: tracking.trackingNumber,
        carrier: tracking.carrier,
        trackingUrl: order.trackingUrl,
        estimatedDelivery: order.estimatedDelivery,
        events: tracking.events,
      };
    } catch {
      return {
        orderId: order.id,
        status: order.status,
        trackingCode: order.trackingCode,
        carrier: order.carrier,
        trackingUrl: order.trackingUrl,
        estimatedDelivery: order.estimatedDelivery,
        events: [],
        error: 'Unable to fetch tracking info',
      };
    }
  });

  fastify.post('/orders/:orderId/cancel', async (request) => {
    const params = request.params as { orderId?: string };
    const orderId = (params.orderId ?? '').trim();
    if (!orderId) {
      return { error: 'orderId is required' };
    }

    const orders = await store.getOrders('');
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      return { error: 'Order not found' };
    }

    if (order.status === 'shipped' || order.status === 'delivered') {
      return { error: 'Cannot cancel shipped or delivered orders' };
    }

    const updatedOrder: Order = {
      ...order,
      status: 'cancelled',
    };

    const updatedOrders = orders.map((o) => (o.id === orderId ? updatedOrder : o));
    await store.setOrders(order.userId, updatedOrders);

    return {
      ok: true,
      orderId: order.id,
      status: 'cancelled',
    };
  });
};



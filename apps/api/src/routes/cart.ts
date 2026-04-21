import { randomBytes, randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import {
  createCommerceStore,
  type CartLine,
  type CommerceStore,
  type Order,
} from '../services/commerceStore.js';
import { computeCheckoutTotal, getSessionContext, normalizeUnitPriceRon } from './utils.js';

type CartRoutesOptions = {
  store?: CommerceStore;
  firestore?: Firestore | null;
  shopifyStoreDomain?: string;
  storefrontToken?: string;
  loyaltySigningKey?: string;
  posScanApiKeys?: string[];
};

type StorefrontGraphQLError = { message: string };
type StorefrontGraphQLResponse<T> = { data?: T; errors?: StorefrontGraphQLError[] };
type StorefrontProductVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  sku?: string | null;
  price: { amount: string; currencyCode: string };
};
type StorefrontProductVariantsResult = {
  product: {
    id: string;
    title: string;
    variants: { nodes: StorefrontProductVariantNode[] };
  } | null;
};
type StorefrontCartCreateResult = {
  cartCreate: {
    cart?: { id: string; checkoutUrl: string } | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
};

type ResolvedStorefrontVariant = {
  productId: string;
  productTitle: string;
  merchandiseId: string;
  variantTitle: string;
  sku?: string;
  availableForSale: boolean;
  priceRon: number;
  currencyCode: string;
};

const STOREFRONT_PRODUCT_VARIANTS_QUERY = `query DacusResolveCartProductVariants($id: ID!) { product(id: $id) { id title variants(first: 50) { nodes { id title availableForSale sku price { amount currencyCode } } } } } }`;
const STOREFRONT_CART_CREATE_MUTATION = `mutation DacusCreateCheckoutCart($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl } userErrors { field message } } } }`;

type CartValidationIssue = {
  lineKey: string;
  productId: string;
  variantId?: string;
  code:
    | 'invalid_product_id'
    | 'invalid_quantity'
    | 'product_not_found'
    | 'variant_not_found'
    | 'out_of_stock'
    | 'price_mismatch';
  message: string;
  messageRo: string;
  expectedUnitPriceRon?: number;
  providedUnitPriceRon?: number;
};
type ResolvedCartLine = {
  line: CartLine;
  merchandiseId: string;
  currencyCode: string;
  productTitle: string;
};
type ResolvedCartPayload = {
  resolvedLines: ResolvedCartLine[];
  issues: CartValidationIssue[];
  priceAdjusted: boolean;
};

const normalizeShopifyProductId = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^gid:\/\/shopify\/Product\/\d+$/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `gid://shopify/Product/${trimmed}`;
  return null;
};

const pickMatchingVariant = (
  variants: ResolvedStorefrontVariant[],
  requestedVariantId?: string,
) => {
  const token = (requestedVariantId ?? '').trim();
  if (!token) return variants[0] ?? null;
  const lowerToken = token.toLowerCase();
  return (
    variants.find((v) => v.merchandiseId === token) ??
    variants.find((v) => (v.sku ?? '').toLowerCase() === lowerToken) ??
    variants[0] ??
    null
  );
};

const queryStorefront = async <T>(
  options: CartRoutesOptions,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const shopifyStoreDomain = (options.shopifyStoreDomain ?? '').trim();
  const storefrontToken = (options.storefrontToken ?? '').trim();
  if (!shopifyStoreDomain || !storefrontToken)
    throw new Error('Storefront checkout is not configured.');

  const endpoint = `https://${shopifyStoreDomain}/api/2024-10/graphql.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) throw new Error(`Storefront request failed with status ${response.status}`);
  const payload = (await response.json()) as StorefrontGraphQLResponse<T>;
  if (payload.errors?.length) throw new Error(payload.errors.map((e) => e.message).join('; '));
  if (!payload.data) throw new Error('Storefront response does not include data.');
  return payload.data;
};

const fetchStorefrontProductVariants = async (
  options: CartRoutesOptions,
  productId: string,
): Promise<ResolvedStorefrontVariant[]> => {
  const productData = await queryStorefront<StorefrontProductVariantsResult>(
    options,
    STOREFRONT_PRODUCT_VARIANTS_QUERY,
    { id: productId },
  );
  if (!productData.product) return [];
  return productData.product.variants.nodes
    .map((variant) => {
      const priceRon = normalizeUnitPriceRon(variant.price.amount);
      if (priceRon === null) return null;
      return {
        productId: productData.product?.id ?? productId,
        productTitle: productData.product?.title ?? 'Produs Dacus',
        merchandiseId: variant.id,
        variantTitle: variant.title,
        ...(variant.sku ? { sku: variant.sku } : {}),
        availableForSale: variant.availableForSale,
        priceRon,
        currencyCode: variant.price.currencyCode,
      };
    })
    .filter((v): v is ResolvedStorefrontVariant => !!v);
};

const resolveCartAgainstStorefront = async (
  options: CartRoutesOptions,
  lines: CartLine[],
  strictPriceMatch: boolean,
): Promise<ResolvedCartPayload> => {
  const issues: CartValidationIssue[] = [];
  const resolvedLines: ResolvedCartLine[] = [];
  const variantsCache = new Map<string, ResolvedStorefrontVariant[]>();
  let priceAdjusted = false;

  for (const line of lines) {
    const productIdInput = (line.productId ?? '').trim();
    const variantIdInput = (line.variantId ?? '').trim();
    const lineKey = `${productIdInput}::${variantIdInput}`;
    const normalizedProductId = normalizeShopifyProductId(productIdInput);
    const quantity = Math.trunc(Number(line.quantity ?? 0));

    if (!normalizedProductId) {
      issues.push({
        lineKey,
        productId: productIdInput,
        ...(variantIdInput ? { variantId: variantIdInput } : {}),
        code: 'invalid_product_id',
        message: 'Cart line has an invalid Shopify product id.',
        messageRo: 'Linia din coș are un produs invalid.',
      });
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      issues.push({
        lineKey,
        productId: normalizedProductId,
        ...(variantIdInput ? { variantId: variantIdInput } : {}),
        code: 'invalid_quantity',
        message: 'Cart line quantity must be at least 1.',
        messageRo: 'Cantitatea trebuie să fie cel puțin 1.',
      });
      continue;
    }

    let variants = variantsCache.get(normalizedProductId);
    if (!variants) {
      variants = await fetchStorefrontProductVariants(options, normalizedProductId);
      variantsCache.set(normalizedProductId, variants);
    }

    if (variants.length === 0) {
      issues.push({
        lineKey,
        productId: normalizedProductId,
        ...(variantIdInput ? { variantId: variantIdInput } : {}),
        code: 'product_not_found',
        message: 'Product is no longer available in Storefront.',
        messageRo: 'Produsul nu mai este disponibil în Storefront.',
      });
      continue;
    }

    const pickedVariant = pickMatchingVariant(variants, variantIdInput || undefined);
    if (!pickedVariant) {
      issues.push({
        lineKey,
        productId: normalizedProductId,
        ...(variantIdInput ? { variantId: variantIdInput } : {}),
        code: 'variant_not_found',
        message: 'Requested product variant no longer exists.',
        messageRo: 'Varianta aleasă nu mai există.',
      });
      continue;
    }

    if (!pickedVariant.availableForSale) {
      issues.push({
        lineKey,
        productId: normalizedProductId,
        variantId: pickedVariant.merchandiseId,
        code: 'out_of_stock',
        message: 'Requested variant is out of stock.',
        messageRo: 'Varianta selectată nu este în stoc.',
      });
      continue;
    }

    const providedUnitPrice = normalizeUnitPriceRon(line.unitPriceRon);
    const priceMismatch =
      providedUnitPrice === null || Math.abs(providedUnitPrice - pickedVariant.priceRon) >= 0.01;
    if (priceMismatch && strictPriceMatch) {
      issues.push({
        lineKey,
        productId: normalizedProductId,
        variantId: pickedVariant.merchandiseId,
        code: 'price_mismatch',
        message: 'Cart line price is stale and must be refreshed.',
        messageRo: 'Prețul din coș este depășit și trebuie actualizat.',
        expectedUnitPriceRon: pickedVariant.priceRon,
        ...(typeof providedUnitPrice === 'number'
          ? { providedUnitPriceRon: providedUnitPrice }
          : {}),
      });
      continue;
    }

    if (priceMismatch) priceAdjusted = true;
    resolvedLines.push({
      line: {
        productId: normalizedProductId,
        variantId: pickedVariant.merchandiseId,
        quantity,
        unitPriceRon: pickedVariant.priceRon,
      },
      merchandiseId: pickedVariant.merchandiseId,
      currencyCode: pickedVariant.currencyCode,
      productTitle: pickedVariant.productTitle,
    });
  }

  return { resolvedLines, issues, priceAdjusted };
};

const dispatchPushToRegisteredDevices = async (
  store: CommerceStore,
  userId: string,
  payload: { title: string; message: string; data?: Record<string, string> },
) => {
  const title = payload.title.trim();
  const message = payload.message.trim();
  if (!title || !message) return 0;
  const registrations = await store.getDeviceRegistrations(userId);
  const routable = registrations.filter((r) => r.pushToken.trim().length > 0);
  if (routable.length === 0) return 0;
  return routable.length;
};

const addNotificationWithPush = async (
  store: CommerceStore,
  userId: string,
  title: string,
  message: string,
  data?: Record<string, string>,
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
  return dispatchPushToRegisteredDevices(store, userId, {
    title,
    message,
    ...(data ? { data } : {}),
  });
};

export const cartRoutes: FastifyPluginAsync<CartRoutesOptions> = async (fastify, options) => {
  const store = options.store ?? createCommerceStore(options.firestore ?? null);

  fastify.get('/cart', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }
    return { lines: await store.getCart(sessionCtx.user.id) };
  });

  fastify.put('/cart/lines', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const body = (request.body ?? {}) as {
      productId?: string;
      variantId?: string;
      quantity?: number;
      unitPriceRon?: number;
    };
    const productId = (body.productId ?? '').trim();
    const variantId = (body.variantId ?? '').trim() || undefined;
    const quantity = Number(body.quantity ?? 0);
    const unitPriceRon = normalizeUnitPriceRon(body.unitPriceRon);

    if (
      !productId ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      (quantity > 0 && unitPriceRon === null)
    ) {
      reply.code(400);
      return { error: 'Invalid cart line payload.' };
    }

    const current = await store.getCart(sessionCtx.user.id);
    const lineKey = `${productId}::${variantId ?? ''}`;
    const filtered = current.filter(
      (line) => `${line.productId}::${line.variantId ?? ''}` !== lineKey,
    );
    const next =
      quantity === 0
        ? filtered
        : [
            ...filtered,
            {
              productId,
              ...(variantId ? { variantId } : {}),
              quantity,
              ...(typeof unitPriceRon === 'number' ? { unitPriceRon } : {}),
            },
          ];

    await store.setCart(sessionCtx.user.id, next);
    return { lines: next };
  });

  fastify.put('/cart/replace', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const body = (request.body ?? {}) as {
      lines?: Array<{
        productId?: string;
        variantId?: string;
        quantity?: number;
        unitPriceRon?: number;
      }>;
    };

    if (!Array.isArray(body.lines)) {
      reply.code(400);
      return { error: 'Invalid cart payload. Expected lines array.' };
    }

    const nextByKey = new Map<string, CartLine>();

    for (const [index, item] of body.lines.entries()) {
      const productId = (item?.productId ?? '').trim();
      const variantId = (item?.variantId ?? '').trim() || undefined;
      const quantityRaw = Number(item?.quantity ?? 0);
      const quantity = Number.isFinite(quantityRaw) ? Math.trunc(quantityRaw) : NaN;
      const unitPriceRon = normalizeUnitPriceRon(item?.unitPriceRon);

      if (!productId || !Number.isFinite(quantity) || quantity < 0) {
        reply.code(400);
        return { error: `Invalid cart line at index ${index}.` };
      }

      if (quantity === 0) continue;
      if (unitPriceRon === null) {
        reply.code(400);
        return { error: `Cart line at index ${index} requires unitPriceRon.` };
      }

      const line: CartLine = {
        productId,
        ...(variantId ? { variantId } : {}),
        quantity,
        unitPriceRon,
      };

      nextByKey.set(`${productId}::${variantId ?? ''}`, line);
    }

    const next = Array.from(nextByKey.values());
    await store.setCart(sessionCtx.user.id, next);
    return { lines: next };
  });

  fastify.delete('/cart/lines/:productId', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const params = request.params as { productId: string };
    const query = request.query as { variantId?: string };
    const variantId = query.variantId?.trim() || '';
    const lineKey = `${params.productId}::${variantId}`;
    const next = (await store.getCart(sessionCtx.user.id)).filter(
      (line) => `${line.productId}::${line.variantId ?? ''}` !== lineKey,
    );
    await store.setCart(sessionCtx.user.id, next);
    return { lines: next };
  });

  fastify.post('/cart/validate', async (request, reply) => {
    const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
    if (!sessionCtx) {
      reply.code(401);
      return { error: 'Unauthorized.' };
    }

    const lines = await store.getCart(sessionCtx.user.id);
    if (lines.length === 0) {
      return { ok: true, issues: [] as CartValidationIssue[], lines, totalRon: 0 };
    }

    let validation: ResolvedCartPayload;
    try {
      validation = await resolveCartAgainstStorefront(options, lines, false);
    } catch (error) {
      reply.code(502);
      return {
        error: 'Cart validation is temporarily unavailable.',
        ...(error instanceof Error ? { errorDetails: error.message } : {}),
      };
    }

    const normalizedLines = validation.resolvedLines.map((item) => item.line);
    if (validation.priceAdjusted) {
      await store.setCart(sessionCtx.user.id, normalizedLines);
    }

    return {
      ok: validation.issues.length === 0,
      issues: validation.issues,
      lines: normalizedLines,
      totalRon: computeCheckoutTotal(normalizedLines),
    };
  });

  fastify.post(
    '/cart/checkout',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const sessionCtx = await getSessionContext(store, request.headers as Record<string, unknown>);
      if (!sessionCtx) {
        reply.code(401);
        return { error: 'Unauthorized.' };
      }

      const body = (request.body ?? {}) as { currency?: string; addressId?: string };
      const currency = (body.currency ?? 'RON').toUpperCase();
      const lines = await store.getCart(sessionCtx.user.id);

      if (lines.length === 0) {
        reply.code(400);
        return { error: 'Cart is empty.' };
      }

      const addresses = await store.getAddresses(sessionCtx.user.id);
      const selectedAddressId =
        typeof body.addressId === 'string' && body.addressId.trim().length > 0
          ? body.addressId.trim()
          : ((await store.getSelectedAddressId(sessionCtx.user.id)) ?? null);
      const selectedAddress = selectedAddressId
        ? addresses.find((item) => item.id === selectedAddressId)
        : undefined;

      if (!selectedAddress) {
        reply.code(400);
        return {
          error: 'A shipping address is required before checkout.',
          errorRo: 'Selectează o adresă de livrare înainte de checkout.',
        };
      }

      let validation: ResolvedCartPayload;
      try {
        validation = await resolveCartAgainstStorefront(options, lines, true);
      } catch (error) {
        reply.code(502);
        return {
          error: 'Checkout is temporarily unavailable.',
          ...(error instanceof Error ? { errorDetails: error.message } : {}),
        };
      }

      if (validation.issues.length > 0 || validation.resolvedLines.length === 0) {
        reply.code(409);
        return {
          error: 'Cart validation failed. Refresh your cart before checkout.',
          errorRo: 'Coșul are produse invalide. Actualizează coșul înainte de checkout.',
          issues: validation.issues,
        };
      }

      const normalizedLines = validation.resolvedLines.map((item) => item.line);
      await store.setCart(sessionCtx.user.id, normalizedLines);

      let checkoutUrl = '';
      let externalCheckoutId = '';
      try {
        const storefrontPayload = await queryStorefront<StorefrontCartCreateResult>(
          options,
          STOREFRONT_CART_CREATE_MUTATION,
          {
            input: {
              lines: validation.resolvedLines.map((item) => ({
                merchandiseId: item.merchandiseId,
                quantity: item.line.quantity,
              })),
              attributes: [
                { key: 'dacus_user_id', value: sessionCtx.user.id },
                { key: 'dacus_address_id', value: selectedAddress.id },
              ],
              buyerIdentity: {
                email: sessionCtx.user.email,
                countryCode: selectedAddress.countryCode,
              },
            },
          },
        );

        const userErrors = storefrontPayload.cartCreate.userErrors ?? [];
        if (userErrors.length > 0 || !storefrontPayload.cartCreate.cart?.checkoutUrl) {
          reply.code(502);
          return {
            error: 'Shopify checkout creation failed.',
            details: userErrors.map((item) => item.message),
          };
        }

        checkoutUrl = storefrontPayload.cartCreate.cart.checkoutUrl;
        externalCheckoutId = storefrontPayload.cartCreate.cart.id;
      } catch (error) {
        reply.code(502);
        return {
          error: 'Checkout provider is unavailable.',
          ...(error instanceof Error ? { errorDetails: error.message } : {}),
        };
      }

      const totalRon = computeCheckoutTotal(normalizedLines);
      const order: Order = {
        id: `ORD-${Date.now()}`,
        userId: sessionCtx.user.id,
        lines: normalizedLines,
        totalRon,
        currency,
        status: 'created',
        trackingCode: `TRK-${randomBytes(4).toString('hex').toUpperCase()}`,
        checkoutUrl,
        ...(externalCheckoutId ? { externalCheckoutId } : {}),
        addressId: selectedAddress.id,
        createdAt: new Date().toISOString(),
      };

      const currentOrders = await store.getOrders(sessionCtx.user.id);
      await store.setOrders(sessionCtx.user.id, [order, ...currentOrders]);
      await store.setCart(sessionCtx.user.id, []);

      const notifiedDevices = await addNotificationWithPush(
        store,
        sessionCtx.user.id,
        'Comandă creată',
        `Comanda ${order.id} a fost plasată. Urmărire: ${order.trackingCode}`,
        { orderId: order.id, trackingCode: order.trackingCode ?? '' },
      );

      return {
        orderId: order.id,
        checkoutUrl: order.checkoutUrl,
        trackingCode: order.trackingCode,
        totalRon: order.totalRon,
        currency: order.currency,
        notifiedDevices,
      };
    },
  );
};

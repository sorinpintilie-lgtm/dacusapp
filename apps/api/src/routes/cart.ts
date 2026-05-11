import { randomBytes, randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

import {
  createCommerceStore,
  createInMemoryCommerceStore,
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

const STOREFRONT_PRODUCT_VARIANTS_QUERY = `query DacusResolveCartProductVariants($id: ID!) { product(id: $id) { id title variants(first: 50) { nodes { id title availableForSale sku price { amount currencyCode } } } } }`;
const STOREFRONT_CART_CREATE_MUTATION = `mutation DacusCreateCheckoutCart($input: CartInput!) { cartCreate(input: $input) { cart { id checkoutUrl } userErrors { field message } } }`;

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
  console.log(`[STOREFRONT] Domain: ${shopifyStoreDomain}, Token configured: ${storefrontToken !== 'replace-with-storefront-token'}`);
  if (!shopifyStoreDomain || !storefrontToken)
    throw new Error('Storefront checkout is not configured.');
  if (storefrontToken === 'replace-with-storefront-token')
    throw new Error('Storefront token not configured. Please set SHOPIFY_STOREFRONT_TOKEN in .env file.');

  const endpoint = `https://${shopifyStoreDomain}/api/2024-04/graphql.json`;
  console.log(`[STOREFRONT] Making request to: ${endpoint}`);
  console.log(`[STOREFRONT] Using token: ${storefrontToken.substring(0, 10)}...`);

  const requestBody = JSON.stringify({ query, variables });
  console.log(`[STOREFRONT] Request body length: ${requestBody.length}`);
  console.log(`[STOREFRONT] Query preview:`, query.substring(0, 100) + '...');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: requestBody,
  });

  console.log(`[STOREFRONT] Response status: ${response.status}`);
  console.log(`[STOREFRONT] Response headers:`, Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (e) {
      responseText = 'Could not read response body';
    }
    console.error(`[STOREFRONT] Response body:`, responseText);

    if (response.status === 404) {
      throw new Error(`Store not found or API endpoint incorrect. Status: ${response.status}, Body: ${responseText}`);
    } else if (response.status === 401) {
      throw new Error(`Authentication failed - invalid storefront token. Status: ${response.status}, Body: ${responseText}`);
    } else if (response.status === 403) {
      throw new Error(`Access forbidden - storefront API not enabled or permissions missing. Status: ${response.status}, Body: ${responseText}`);
    } else {
      throw new Error(`Storefront request failed with status ${response.status}: ${responseText}`);
    }
  }
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
  const store = options.store ?? (options.firestore ? createCommerceStore(options.firestore) : createInMemoryCommerceStore());

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

      const body = (request.body ?? {}) as {
        currency?: string;
        addressId?: string;
        address?: {
          fullName?: string;
          phone?: string;
          line1?: string;
          line2?: string;
          city?: string;
          county?: string;
          postalCode?: string;
          countryCode?: string;
        };
      };
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

      const inlineAddress = body.address;
      const hasInlineAddress = Boolean(
        inlineAddress?.fullName?.trim() &&
        inlineAddress?.phone?.trim() &&
        inlineAddress?.line1?.trim() &&
        inlineAddress?.city?.trim() &&
        inlineAddress?.county?.trim() &&
        inlineAddress?.postalCode?.trim(),
      );

      if (!selectedAddress && !hasInlineAddress) {
        reply.code(400);
        return {
          error: 'A shipping address is required before checkout.',
          errorRo: 'Completează toate câmpurile pentru adresa de livrare.',
          requiresAddress: true,
        };
      }

      const checkoutAddress = selectedAddress ?? {
        id: `inline-${Date.now()}`,
        label: 'Livrare',
        fullName: inlineAddress?.fullName ?? '',
        phone: inlineAddress?.phone ?? '',
        line1: inlineAddress?.line1 ?? '',
        line2: inlineAddress?.line2,
        city: inlineAddress?.city ?? '',
        county: inlineAddress?.county ?? '',
        postalCode: inlineAddress?.postalCode ?? '',
        countryCode: (inlineAddress?.countryCode ?? 'RO').toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

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
                { key: 'dacus_address_id', value: checkoutAddress.id },
              ],
              buyerIdentity: {
                email: sessionCtx.user.email,
                countryCode: checkoutAddress.countryCode,
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
        addressId: checkoutAddress.id,
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

  fastify.post(
    '/cart/checkout-guest',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        currency?: string;
        lines: CartLine[];
        address: {
          fullName?: string;
          phone?: string;
          line1?: string;
          line2?: string;
          city?: string;
          county?: string;
          postalCode?: string;
          countryCode?: string;
        };
        deviceId: string;
      };

      const currency = (body.currency ?? 'RON').toUpperCase();
      const { lines, address, deviceId } = body;

      // Validate required fields
      if (!lines || lines.length === 0) {
        reply.code(400);
        return { error: 'Cart is empty.' };
      }

      // Address is optional for guest checkout - Shopify will handle it

      try {
        // Validate cart lines against Shopify storefront
        console.log('[GUEST_CHECKOUT] Validating cart lines:', lines);
        const validation = await resolveCartAgainstStorefront(options, lines, false);
        console.log('[GUEST_CHECKOUT] Validation result:', {
          issuesCount: validation.issues.length,
          resolvedLinesCount: validation.resolvedLines.length,
          issues: validation.issues,
        });

        if (validation.issues.length > 0 || validation.resolvedLines.length === 0) {
          console.error('[GUEST_CHECKOUT] Cart validation failed:', validation.issues);
          reply.code(400);
          return {
            error: 'Cart validation failed.',
            errorRo: 'Coșul conține produse invalide.',
            issues: validation.issues,
          };
        }

        const normalizedLines = validation.resolvedLines.map((item) => item.line);
        console.log('[GUEST_CHECKOUT] Resolved merchandise IDs:', validation.resolvedLines.map(item => ({
          productId: item.line.productId,
          merchandiseId: item.merchandiseId,
          quantity: item.line.quantity,
        })));

        // Create guest checkout using deviceId as identifier
        // Address is optional - use default if not provided
        const checkoutAddress = {
          id: `guest-${deviceId}-${Date.now()}`,
          label: 'Adresă guest',
          fullName: address?.fullName?.trim() || 'Client Guest',
          phone: address?.phone?.trim() || '',
          line1: address?.line1?.trim() || '',
          line2: address?.line2?.trim() || '',
          city: address?.city?.trim() || '',
          county: address?.county?.trim() || '',
          postalCode: address?.postalCode?.trim() || '',
          countryCode: address?.countryCode?.trim() || 'RO',
        };

        let checkoutUrl = '';

        // Create Shopify checkout for guest
        const storefrontPayload = await queryStorefront(
          options,
          STOREFRONT_CART_CREATE_MUTATION,
          {
            input: {
              lines: validation.resolvedLines.map((item) => ({
                merchandiseId: item.merchandiseId,
                quantity: item.line.quantity,
              })),
              attributes: [
                { key: 'dacus_device_id', value: deviceId },
                { key: 'dacus_guest_checkout', value: 'true' },
                { key: 'dacus_address_id', value: checkoutAddress.id },
              ],
              buyerIdentity: {
                countryCode: checkoutAddress.countryCode,
              },
            },
          },
        ) as any;

        const userErrors = storefrontPayload.cartCreate.userErrors ?? [];
        const cart = storefrontPayload.cartCreate.cart;

        console.log('[GUEST_CHECKOUT] Storefront response:', {
          hasErrors: userErrors.length > 0,
          errors: userErrors,
          hasCart: !!cart,
          hasCheckoutUrl: !!cart?.checkoutUrl,
          checkoutUrl: cart?.checkoutUrl,
        });

        if (userErrors.length > 0) {
          console.error('[GUEST_CHECKOUT] Shopify user errors:', userErrors);
          reply.code(400);
          return {
            error: 'Shopify checkout creation failed.',
            errorRo: 'Nu s-a putut crea checkout-ul.',
            details: userErrors.map((e: any) => e.message).join(', '),
          };
        }

        if (!cart?.checkoutUrl) {
          console.error('[GUEST_CHECKOUT] No checkout URL returned from Shopify');
          reply.code(500);
          return {
            error: 'No checkout URL generated.',
            errorRo: 'Nu s-a generat URL-ul de checkout.',
          };
        }

        checkoutUrl = cart.checkoutUrl;
        console.log(`[GUEST_CHECKOUT] Generated checkout URL: ${checkoutUrl}`);

        // Validate URL format
        try {
          const url = new URL(checkoutUrl);
          if (!url.hostname.includes('myshopify.com')) {
            console.warn('[GUEST_CHECKOUT] Checkout URL does not point to Shopify:', checkoutUrl);
          }
        } catch (error) {
          console.error('[GUEST_CHECKOUT] Invalid checkout URL format:', checkoutUrl);
          reply.code(500);
          return {
            error: 'Invalid checkout URL generated.',
            errorRo: 'URL-ul de checkout generat este invalid.',
          };
        }

        // Create order record for guest
        const orderId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const totalRon = computeCheckoutTotal(normalizedLines);

        // Store guest order (you might want to persist this differently)
        console.log(`[GUEST_CHECKOUT] Created order ${orderId} for device ${deviceId}`);

        return {
          orderId,
          checkoutUrl,
          totalRon,
          currency,
        };
      } catch (error) {
        console.error('[GUEST_CHECKOUT] Error:', error);
        reply.code(500);
        return { error: 'Checkout failed.' };
      }
    },
  );

fastify.get(
  '/shopify-test',
  async (request, reply) => {
    console.log('[SHOPIFY_TEST] Testing basic connection...');
    console.log('[SHOPIFY_TEST] Config:', {
      domain: options.shopifyStoreDomain,
      hasToken: !!options.storefrontToken && options.storefrontToken !== 'replace-with-storefront-token',
      tokenPrefix: options.storefrontToken?.substring(0, 6)
    });

    try {
      // Simple test query to check if Shopify connection works
      const testQuery = `
        query {
          shop {
            name
            primaryDomain {
              url
            }
          }
        }
      `;

      const result = await queryStorefront(options, testQuery, {});
      console.log('[SHOPIFY_TEST] Success! Shop info:', (result as any).shop);
      return {
        success: true,
        message: 'Shopify connection successful!',
        shop: (result as any).shop,
        config: {
          domain: options.shopifyStoreDomain,
          hasToken: !!options.storefrontToken && options.storefrontToken !== 'replace-with-storefront-token',
          tokenPrefix: options.storefrontToken?.substring(0, 6)
        }
      };
    } catch (error) {
      console.error('[SHOPIFY_TEST] Error details:', error);
      return {
        success: false,
        message: 'Shopify connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        config: {
          domain: options.shopifyStoreDomain,
          hasToken: !!options.storefrontToken && options.storefrontToken !== 'replace-with-storefront-token',
          tokenPrefix: options.storefrontToken?.substring(0, 6)
        }
      };
    }
  },
);

fastify.post(
  '/cart/validate-guest',
  async (request, reply) => {
      const body = (request.body ?? {}) as {
        lines: CartLine[];
      };

      if (!Array.isArray(body.lines) || body.lines.length === 0) {
        reply.code(400);
        return { ok: false, issues: [{ code: 'empty_cart', message: 'Cart is empty.' }] };
      }

      try {
        const validation = await resolveCartAgainstStorefront(options, body.lines, false);

        return {
          ok: validation.issues.length === 0,
          lines: validation.resolvedLines.map((item) => item.line),
          issues: validation.issues,
        };
      } catch (error) {
        console.error('[GUEST_VALIDATE] Error:', error);
        reply.code(500);
        return {
          ok: false,
          issues: [{ code: 'validation_error', message: 'Cart validation failed.' }],
        };
      }
    },
  );
};

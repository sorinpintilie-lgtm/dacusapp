import { mobileEnv } from '../config/env';
import { createStorefrontClient } from '../data/shopifyCatalog';

/**
 * A guest pays on Shopify's checkout page, outside the app, so the app cannot see the order. What it can
 * see is the cart behind the checkout link: once Shopify turns that cart into an order, the Storefront API
 * stops returning it. That tells the app whether to empty the customer's cart.
 */
export type CheckoutOutcome = 'completed' | 'open' | 'unknown';

/** `https://dacus.ro/cart/c/<token>?key=<key>` → `gid://shopify/Cart/<token>?key=<key>`. */
export const cartIdFromCheckoutUrl = (checkoutUrl: string): string | null => {
  try {
    const url = new URL(checkoutUrl);
    const token = url.pathname.match(/\/cart\/c\/([^/]+)/)?.[1];
    if (!token) return null;
    const key = url.searchParams.get('key');
    return `gid://shopify/Cart/${token}${key ? `?key=${key}` : ''}`;
  } catch {
    return null;
  }
};

const CART_QUERY = `query CheckoutCart($id: ID!) { cart(id: $id) { id } }`;

export const checkCheckoutOutcome = async (
  checkoutUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckoutOutcome> => {
  const cartId = cartIdFromCheckoutUrl(checkoutUrl);
  if (!cartId || !mobileEnv.shopifyStoreDomain || !mobileEnv.storefrontPublicToken) return 'unknown';
  try {
    const query = createStorefrontClient(mobileEnv.shopifyStoreDomain, mobileEnv.storefrontPublicToken, fetchImpl);
    const data = await query<{ cart: { id: string } | null }>(CART_QUERY, { id: cartId });
    return data.cart ? 'open' : 'completed';
  } catch {
    return 'unknown';
  }
};

import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/env', () => ({
  mobileEnv: { shopifyStoreDomain: 'shop.example', storefrontPublicToken: 'public-token' },
}));

import { cartIdFromCheckoutUrl, checkCheckoutOutcome } from './checkoutStatus';

const URL_ = 'https://dacus.ro/cart/c/hWNHxepJ1wMRE4qrSVgD6d5H?key=abc%3D&_s=1';

const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('cartIdFromCheckoutUrl', () => {
  it('turns a checkout link into the Storefront cart id, keeping the key', () => {
    expect(cartIdFromCheckoutUrl(URL_)).toBe('gid://shopify/Cart/hWNHxepJ1wMRE4qrSVgD6d5H?key=abc=');
  });

  it('returns null for links that are not cart checkouts', () => {
    expect(cartIdFromCheckoutUrl('https://dacus.ro/products/x')).toBeNull();
    expect(cartIdFromCheckoutUrl('not a url')).toBeNull();
  });
});

describe('checkCheckoutOutcome', () => {
  it('is completed once Shopify no longer returns the cart', async () => {
    expect(await checkCheckoutOutcome(URL_, respond({ data: { cart: null } }))).toBe('completed');
  });

  it('is open while the cart still exists', async () => {
    expect(await checkCheckoutOutcome(URL_, respond({ data: { cart: { id: 'gid://shopify/Cart/x' } } }))).toBe('open');
  });

  it('is unknown when Shopify cannot be reached, so the cart is kept', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await checkCheckoutOutcome(URL_, failing)).toBe('unknown');
    expect(await checkCheckoutOutcome(URL_, respond({ errors: [{ message: 'bad' }] }))).toBe('unknown');
  });
});

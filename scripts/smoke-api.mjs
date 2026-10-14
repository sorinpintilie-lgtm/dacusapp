// Smoke test for the deployed API (no account needed): public endpoints answer, guest checkout
// produces a working Shopify checkout URL, and account endpoints refuse anonymous requests.
// Usage: node scripts/smoke-api.mjs [baseUrl]
import fs from 'node:fs';

const BASE = process.argv[2] || 'https://europe-west1-dacus-b40f9.cloudfunctions.net/api';
const products = JSON.parse(fs.readFileSync('apps/mobile/src/data/catalogProducts.json', 'utf8'));
const product = products.find((p) => p.stockLabel === 'În stoc' && p.variantId && p.name.includes('Cafetier'));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const call = async (path, init = {}) => {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

const health = await call('/health');
check('GET /health', health.status === 200, JSON.stringify(health.json).slice(0, 80));

// Product search runs on the phone against the bundled catalog; the server index is not used.

const sugg = await call('/search/suggestions?q=bec');
check('GET /search/suggestions', sugg.status === 200, `status ${sugg.status}`);

const line = { productId: product.id, variantId: product.variantId, quantity: 1, unitPriceRon: product.priceRon };
const val = await call('/cart/validate-guest', { method: 'POST', body: { lines: [line] } });
check('POST /cart/validate-guest', val.status === 200, `status ${val.status} ${JSON.stringify(val.json).slice(0, 160)}`);

const co = await call('/cart/checkout-guest', { method: 'POST', body: { currency: 'RON', lines: [line], deviceId: 'smoke-test' } });
check('POST /cart/checkout-guest', co.status === 200 && !!co.json?.checkoutUrl, `status ${co.status} total ${co.json?.totalRon}`);
if (co.json?.checkoutUrl) {
  // Shopify answers scripted requests with 403 (bot protection), so only the shape is checked here;
  // the page itself was verified in a real browser.
  const url = new URL(co.json.checkoutUrl);
  check('checkout URL points at the store cart', url.hostname === 'dacus.ro' && url.pathname.startsWith('/cart/c/'), url.origin + url.pathname);
}

for (const path of ['/cart', '/orders', '/account/addresses', '/account/settings', '/wishlist']) {
  const r = await call(path);
  check(`GET ${path} without login is refused`, r.status === 401 || r.status === 403, `status ${r.status}`);
}

console.log(failures ? `\n${failures} failing` : '\nall passing');
process.exit(failures ? 1 : 0);

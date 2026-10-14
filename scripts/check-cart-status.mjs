// Looks up a Shopify cart from a checkout URL via the Storefront API (public token).
// Usage: node scripts/check-cart-status.mjs "<checkoutUrl>"
import process from 'node:process';
import fs from 'node:fs';
if (fs.existsSync('apps/mobile/.env')) process.loadEnvFile('apps/mobile/.env');
const url = new URL(process.argv[2]);
const token = url.pathname.match(/\/cart\/c\/([^/]+)/)?.[1];
const id = `gid://shopify/Cart/${token}?key=${url.searchParams.get('key')}`;
const res = await fetch(`https://${process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'X-Shopify-Storefront-Access-Token': process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN },
  body: JSON.stringify({ query: 'query($id: ID!) { cart(id: $id) { id totalQuantity } }', variables: { id } }),
});
console.log(JSON.stringify(await res.json()));

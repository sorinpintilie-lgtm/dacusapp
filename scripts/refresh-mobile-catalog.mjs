// Rebuilds the catalog bundled in the mobile app straight from Shopify (Storefront API, public token).
// Usage (from the repo root): npm run refresh:catalog:mobile
// Reads EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN / EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN from the environment
// or from apps/mobile/.env, then writes catalogBootstrap.json and catalogProducts.json.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  createStorefrontClient,
  fetchCollections,
  fetchProducts,
} from '../apps/mobile/src/data/shopifyCatalog.ts';

const ENV_FILE = path.resolve('apps/mobile/.env');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const domain =
  process.env.EXPO_PUBLIC_STORE_DOMAIN ||
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN ||
  'f4eb2c-ae.myshopify.com';
const token =
  process.env.EXPO_PUBLIC_PUBLIC_TOKEN || process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
if (!token) {
  console.error(
    'Missing EXPO_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN (set it or add it to apps/mobile/.env).',
  );
  process.exit(1);
}

const DATA_DIR = path.resolve('apps/mobile/src/data');
const query = createStorefrontClient(domain, token);

const generatedAt = new Date().toISOString();
const categories = await fetchCollections(query);
console.log(`[catalog] categories: ${categories.length}`);

const products = await fetchProducts(query, new Set(categories.map((category) => category.id)), {
  onPage: (count) => process.stdout.write(`\r[catalog] products: ${count}`),
});
process.stdout.write('\n');

// Shopify can list a product twice across pages while it is being edited; ids must stay unique.
const unique = Array.from(new Map(products.map((product) => [product.id, product])).values());

fs.writeFileSync(
  path.join(DATA_DIR, 'catalogBootstrap.json'),
  `${JSON.stringify({ stamp: `shopify-${generatedAt}`, generatedAt, categories })}\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(DATA_DIR, 'catalogProducts.json'),
  `${JSON.stringify(unique)}\n`,
  'utf8',
);
console.log(`[catalog] wrote ${unique.length} products, generated at ${generatedAt}`);

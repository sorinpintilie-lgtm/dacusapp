import fs from 'node:fs';
import path from 'node:path';

const SNAPSHOT_PATH = path.resolve('apps/mobile/src/data/catalogSnapshot.json');
const OUTPUT_DIR = path.resolve('apps/mobile/src/data/catalogChunks');
const BOOTSTRAP_PATH = path.resolve('apps/mobile/src/data/catalogBootstrap.json');
const INDEX_TS_PATH = path.resolve('apps/mobile/src/data/catalogChunkIndex.ts');
const HOME_PRODUCTS_LIMIT = 180;

const toFileToken = (value) => Buffer.from(String(value), 'utf8').toString('base64url');

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const categories = Array.isArray(snapshot.categories) ? snapshot.categories : [];
const products = Array.isArray(snapshot.products) ? snapshot.products : [];

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const categoryBuckets = new Map();
for (const category of categories) {
  categoryBuckets.set(category.id, []);
}
categoryBuckets.set('uncategorized', []);

for (const product of products) {
  const membership = Array.isArray(product.categoryIds) && product.categoryIds.length > 0
    ? product.categoryIds
    : [product.categoryId || 'uncategorized'];

  const uniqueMembership = Array.from(new Set(membership.filter(Boolean)));
  for (const categoryId of uniqueMembership) {
    if (!categoryBuckets.has(categoryId)) categoryBuckets.set(categoryId, []);
    categoryBuckets.get(categoryId).push(product);
  }
}

const bootstrapProducts = products.slice(0, HOME_PRODUCTS_LIMIT);
const bootstrap = {
  source: 'bundled-bootstrap',
  stamp: snapshot.stamp ?? null,
  generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
  categories,
  products: bootstrapProducts,
  hasMoreProducts: false,
  productsCursor: null,
};
fs.writeFileSync(BOOTSTRAP_PATH, `${JSON.stringify(bootstrap)}\n`, 'utf8');

const indexLines = [
  "import type { CatalogProduct } from './catalog';",
  '',
  'const chunkMap: Record<string, () => CatalogProduct[]> = {',
];

for (const [categoryId, bucket] of categoryBuckets.entries()) {
  const fileToken = toFileToken(categoryId);
  const fileName = `${fileToken}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(bucket)}\n`, 'utf8');
  indexLines.push(`  ${JSON.stringify(categoryId)}: () => require('./catalogChunks/${fileName}') as CatalogProduct[],`);
}

indexLines.push('};', '', 'export const loadBundledCategoryProducts = (categoryId: string): CatalogProduct[] => {', '  const loader = chunkMap[categoryId];', '  return loader ? loader() : [];', '};', '');

fs.writeFileSync(INDEX_TS_PATH, `${indexLines.join('\n')}\n`, 'utf8');

console.log(`[chunks] categories: ${categories.length}`);
console.log(`[chunks] products: ${products.length}`);
console.log(`[chunks] bootstrap products: ${bootstrapProducts.length}`);
console.log(`[chunks] chunk files: ${categoryBuckets.size}`);

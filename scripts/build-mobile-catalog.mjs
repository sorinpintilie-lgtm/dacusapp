import fs from 'node:fs';
import path from 'node:path';

const SNAPSHOT_PATH = path.resolve('apps/mobile/src/data/catalogSnapshot.json');
const BOOTSTRAP_PATH = path.resolve('apps/mobile/src/data/catalogBootstrap.json');
const PRODUCTS_PATH = path.resolve('apps/mobile/src/data/catalogProducts.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Some Shopify texts carry UTF-8 that was read as Latin-1 ("Ã®" instead of "î"); the app shows the text as is.
const MOJIBAKE = {
  'Äƒ': 'ă',
  'Ä‚': 'Ă',
  'Ã¢': 'â',
  'Ã‚': 'Â',
  'Ã®': 'î',
  'ÃŽ': 'Î',
  'È™': 'ș',
  'È˜': 'Ș',
  'È›': 'ț',
  'Èš': 'Ț',
  'Â·': '·',
  'â€¢': '•',
  'â€”': '-',
  'â€“': '-',
};
const MOJIBAKE_PATTERN = new RegExp(Object.keys(MOJIBAKE).join('|'), 'g');
const fixText = (value) =>
  typeof value === 'string' ? value.replace(MOJIBAKE_PATTERN, (match) => MOJIBAKE[match]) : value;

const cleanCategory = (category) => ({
  ...category,
  name: fixText(category.name),
  ...(category.description !== undefined ? { description: fixText(category.description) } : {}),
});

const cleanProduct = (product) => ({
  ...product,
  name: fixText(product.name),
  brand: fixText(product.brand),
  stockLabel: fixText(product.stockLabel),
  ...(product.description !== undefined ? { description: fixText(product.description) } : {}),
  ...(Array.isArray(product.variants)
    ? { variants: product.variants.map((variant) => ({ ...variant, name: fixText(variant.name) })) }
    : {}),
});

// A fresh Firestore export when present, otherwise the catalog already bundled in the app
// (so the output can be regenerated without exporting again).
const loadSourceCatalog = () => {
  if (fs.existsSync(SNAPSHOT_PATH)) {
    const snapshot = readJson(SNAPSHOT_PATH);
    return {
      categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
      products: Array.isArray(snapshot.products) ? snapshot.products : [],
      stamp: snapshot.stamp ?? null,
      generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
    };
  }

  const bootstrap = readJson(BOOTSTRAP_PATH);
  return {
    categories: Array.isArray(bootstrap.categories) ? bootstrap.categories : [],
    products: fs.existsSync(PRODUCTS_PATH) ? readJson(PRODUCTS_PATH) : [],
    stamp: bootstrap.stamp ?? null,
    generatedAt: bootstrap.generatedAt ?? new Date().toISOString(),
  };
};

const sourceCatalog = loadSourceCatalog();

// The app loads every product at startup and shows them in this order (home featured products first),
// so keep the source order and drop duplicate ids, which would collide as list keys.
const seenIds = new Set();
const products = sourceCatalog.products
  .filter((product) => {
    if (!product?.id || seenIds.has(product.id)) return false;
    seenIds.add(product.id);
    return true;
  })
  .map(cleanProduct);

const bootstrap = {
  stamp: sourceCatalog.stamp ?? null,
  generatedAt: sourceCatalog.generatedAt,
  categories: sourceCatalog.categories.map(cleanCategory),
};

fs.writeFileSync(BOOTSTRAP_PATH, `${JSON.stringify(bootstrap)}\n`, 'utf8');
fs.writeFileSync(PRODUCTS_PATH, `${JSON.stringify(products)}\n`, 'utf8');

console.log(`[catalog] categories: ${sourceCatalog.categories.length}`);
console.log(`[catalog] products: ${products.length}`);

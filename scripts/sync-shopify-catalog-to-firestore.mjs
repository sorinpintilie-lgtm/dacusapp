import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

const SHOPIFY_STORE_DOMAIN =
  process.env.STORE_DOMAIN ||
  process.env.SHOPIFY_STORE_DOMAIN ||
  process.env.EXPO_PUBLIC_STORE_DOMAIN ||
  'f4eb2c-ae.myshopify.com';
const SHOPIFY_STOREFRONT_TOKEN =
  process.env.PUBLIC_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_TOKEN ||
  process.env.EXPO_PUBLIC_PUBLIC_TOKEN ||
  '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'dacus-b40f9';
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
const PAGE_SIZE_MAX = 250;

const COLLECTIONS_QUERY = `
  query SyncCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          description
          image { url }
        }
      }
    }
  }
`;

const PRODUCTS_QUERY = `
  query SyncProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          description
          availableForSale
          featuredImage {
            thumbnailUrl: url(transform: { maxWidth: 420, maxHeight: 420, crop: CENTER })
            imageUrl: url(transform: { maxWidth: 960, maxHeight: 960, crop: CENTER })
          }
          collections(first: 20) {
            edges { node { id } }
          }
          variants(first: 20) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
              }
            }
          }
        }
      }
    }
  }
`;

const assertRequired = (name, value) => {
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
};

const initFirebase = () => {
  if (admin.apps.length > 0) return admin.app();

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const absolute = path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH);
    const raw = fs.readFileSync(absolute, 'utf8');
    const serviceAccount = JSON.parse(raw);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || FIREBASE_PROJECT_ID,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
  });
};

const queryStorefront = async (query, variables) => {
  const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Storefront request failed: ${response.status} ${text.slice(0, 400)}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join('; '));
  }
  if (!payload.data) {
    throw new Error('Shopify Storefront returned no data.');
  }
  return payload.data;
};

const mapCategory = (node) => ({
  id: node.id,
  name: node.title,
  description: node.description || '',
  ...(node.image?.url ? { imageUrl: node.image.url } : {}),
});

const mapProduct = (node, knownCategoryIds) => {
  const collectionIds = Array.from(
    new Set(
      (node.collections?.edges || [])
        .map((edge) => edge?.node?.id)
        .filter((id) => typeof id === 'string' && knownCategoryIds.has(id)),
    ).values(),
  );

  const firstVariant = node.variants?.edges?.[0]?.node;
  const resolvedCategoryId = collectionIds[0] || 'uncategorized';
  const resolvedCategoryIds = collectionIds.length > 0 ? collectionIds : ['uncategorized'];
  const priceRon = Number(firstVariant?.price?.amount || 0);
  const oldPriceRon = firstVariant?.compareAtPrice?.amount
    ? Number(firstVariant.compareAtPrice.amount)
    : undefined;

  return {
    id: node.id,
    categoryId: resolvedCategoryId,
    categoryIds: resolvedCategoryIds,
    handle: node.handle,
    ...(firstVariant?.sku ? { sku: firstVariant.sku } : {}),
    ...(firstVariant?.id ? { variantId: firstVariant.id } : {}),
    name: node.title,
    brand: node.vendor || 'Dacus',
    description: node.description || '',
    ...(node.featuredImage?.thumbnailUrl ? { thumbnailUrl: node.featuredImage.thumbnailUrl } : {}),
    ...(node.featuredImage?.imageUrl ? { imageUrl: node.featuredImage.imageUrl } : {}),
    priceRon,
    ...(typeof oldPriceRon === 'number' ? { oldPriceRon } : {}),
    stockLabel: node.availableForSale ? 'În stoc' : 'Nu este în stoc',
    variants: (node.variants?.edges || []).map(({ node: variant }) => ({
      id: variant.id,
      name: variant.title,
      priceRon: Number(variant.price.amount),
      inStock: Boolean(variant.availableForSale),
    })),
  };
};

const fetchAllCollections = async () => {
  const collections = [];
  let cursor = null;

  while (true) {
    const response = await queryStorefront(COLLECTIONS_QUERY, { first: PAGE_SIZE_MAX, after: cursor });
    const page = response.collections;
    for (const edge of page.edges) collections.push(mapCategory(edge.node));
    if (!page.pageInfo?.hasNextPage || !page.pageInfo?.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  return collections;
};

const fetchAllProducts = async (knownCategoryIds) => {
  const products = [];
  let cursor = null;

  while (true) {
    const response = await queryStorefront(PRODUCTS_QUERY, { first: PAGE_SIZE_MAX, after: cursor });
    const page = response.products;
    for (const edge of page.edges) products.push(mapProduct(edge.node, knownCategoryIds));
    if (!page.pageInfo?.hasNextPage || !page.pageInfo?.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  return products;
};

const clearCollection = async (collectionRef) => {
  const snapshot = await collectionRef.get();
  if (snapshot.empty) return 0;

  let batch = collectionRef.firestore.batch();
  let opCount = 0;
  let deleted = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    opCount += 1;
    deleted += 1;

    if (opCount >= 450) {
      await batch.commit();
      batch = collectionRef.firestore.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();
  return deleted;
};

const writeDocuments = async (collectionRef, items) => {
  let batch = collectionRef.firestore.batch();
  let opCount = 0;
  let written = 0;

  for (const item of items) {
    batch.set(collectionRef.doc(item.id), item);
    opCount += 1;
    written += 1;

    if (opCount >= 450) {
      await batch.commit();
      batch = collectionRef.firestore.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();
  return written;
};

const main = async () => {
  assertRequired('SHOPIFY_STORE_DOMAIN', SHOPIFY_STORE_DOMAIN);
  assertRequired('SHOPIFY_STOREFRONT_TOKEN', SHOPIFY_STOREFRONT_TOKEN);

  initFirebase();
  const db = admin.firestore();

  console.log(`[sync] Shopify domain: ${SHOPIFY_STORE_DOMAIN}`);
  console.log(`[sync] Firestore project: ${FIREBASE_PROJECT_ID}`);

  const categories = await fetchAllCollections();
  const knownCategoryIds = new Set(categories.map((item) => item.id));
  const products = await fetchAllProducts(knownCategoryIds);

  console.log(`[sync] fetched ${categories.length} categories`);
  console.log(`[sync] fetched ${products.length} products`);

  const categoriesRef = db.collection('catalog').doc('meta').collection('categories');
  const productsRef = db.collection('catalog').doc('meta').collection('products');
  const stampRef = db.collection('catalog').doc('stamp');

  const deletedCategories = await clearCollection(categoriesRef);
  const deletedProducts = await clearCollection(productsRef);
  console.log(`[sync] cleared ${deletedCategories} old categories`);
  console.log(`[sync] cleared ${deletedProducts} old products`);

  const writtenCategories = await writeDocuments(categoriesRef, categories);
  const writtenProducts = await writeDocuments(productsRef, products);

  const stamp = `manual-${Date.now()}`;
  await stampRef.set({
    stamp,
    generatedAt: new Date().toISOString(),
    source: 'manual-script',
    counts: { categories: writtenCategories, products: writtenProducts },
  });

  console.log(`[sync] wrote ${writtenCategories} categories`);
  console.log(`[sync] wrote ${writtenProducts} products`);
  console.log(`[sync] updated catalog stamp: ${stamp}`);
  console.log('[sync] done');
};

main().catch((error) => {
  console.error('[sync] failed');
  console.error(error);
  process.exitCode = 1;
});

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPushToken = exports.sendPushNotification = exports.manualCatalogSync = exports.getOrders = exports.addAddress = exports.getAddresses = exports.removeFromCart = exports.addToCart = exports.replaceCart = exports.getCart = exports.getCatalog = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const generateId = () => `ID-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '';
const PAGE_SIZE_MAX = 250;
const queryStorefront = async (query, variables) => {
    const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
        throw new Error(`Storefront request failed: ${response.status}`);
    }
    const payload = (await response.json());
    if (payload.errors?.length) {
        throw new Error(payload.errors.map((e) => e.message).join('; '));
    }
    if (!payload.data) {
        throw new Error('No data returned');
    }
    return payload.data;
};
const COLLECTIONS_QUERY = `
  query GetCollections($first: Int!, $after: String) {
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
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
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
          featuredImage { thumbnailUrl imageUrl }
          collections(first: 10) {
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
const mapProduct = (node, categoryId, categoryIds) => {
    const firstVariant = node.variantEdges?.[0]?.node;
    const firstImage = node.featuredImage;
    return {
        id: node.id,
        categoryId,
        categoryIds,
        handle: node.handle,
        name: node.title,
        brand: node.vendor,
        description: node.description,
        thumbnailUrl: firstImage?.thumbnailUrl,
        imageUrl: firstImage?.imageUrl,
        priceRon: firstVariant ? parseFloat(firstVariant.price.amount) : 0,
        oldPriceRon: firstVariant?.compareAtPrice?.amount
            ? parseFloat(firstVariant.compareAtPrice.amount)
            : undefined,
        stockLabel: node.availableForSale ? 'În stoc' : 'Nu este în stoc',
        variants: node.variantEdges?.map((e) => ({
            id: e.node.id,
            name: e.node.title,
            priceRon: parseFloat(e.node.price.amount),
            inStock: e.node.availableForSale,
        })),
    };
};
// ========== CATALOG FUNCTION ==========
exports.getCatalog = functions.https.onCall(async (request) => {
    const data = request.data;
    const after = data?.after;
    const pageSize = data?.pageSize || 250;
    const categoriesSnapshot = await db
        .collection('catalog')
        .doc('meta')
        .collection('categories')
        .get();
    const categories = categoriesSnapshot.docs.map((doc) => doc.data());
    const productsSnapshot = await db.collection('catalog').doc('meta').collection('products').get();
    let products = productsSnapshot.docs.map((doc) => doc.data());
    if (after) {
        const startIndex = products.findIndex((p) => p.id === after);
        if (startIndex >= 0) {
            products = products.slice(startIndex + 1);
        }
    }
    const paginatedProducts = products.slice(0, pageSize);
    const hasMore = products.length > pageSize;
    const endCursor = hasMore ? paginatedProducts[paginatedProducts.length - 1]?.id : null;
    const stampDoc = await db.collection('catalog').doc('stamp').get();
    const stamp = stampDoc.exists ? stampDoc.data()?.stamp : null;
    return {
        categories,
        products: paginatedProducts,
        hasMoreProducts: hasMore,
        productsCursor: endCursor,
        stamp,
        source: 'cache',
    };
});
// Note: Auth is handled by the Firebase Auth on the client side via context.auth
// The functions check for authenticated users
exports.getCart = functions.https.onCall(async (request) => {
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const cartDoc = await db.collection('carts').doc(userId).get();
    const lines = cartDoc.exists ? cartDoc.data()?.lines || [] : [];
    return lines;
});
exports.replaceCart = functions.https.onCall(async (request) => {
    const data = request.data;
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    await db.collection('carts').doc(userId).set({ lines: data.lines });
    return data.lines;
});
exports.addToCart = functions.https.onCall(async (request) => {
    const data = request.data;
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const { line } = data;
    const cartRef = db.collection('carts').doc(userId);
    const cartDoc = await cartRef.get();
    const currentLines = cartDoc.exists ? cartDoc.data()?.lines || [] : [];
    const existingIndex = currentLines.findIndex((l) => l.productId === line.productId && l.variantId === line.variantId);
    if (existingIndex >= 0) {
        currentLines[existingIndex].quantity += line.quantity;
    }
    else {
        currentLines.push(line);
    }
    await cartRef.set({ lines: currentLines });
    return currentLines;
});
exports.removeFromCart = functions.https.onCall(async (request) => {
    const data = request.data;
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const { productId, variantId } = data;
    const cartRef = db.collection('carts').doc(userId);
    const cartDoc = await cartRef.get();
    const currentLines = cartDoc.exists ? cartDoc.data()?.lines || [] : [];
    const filtered = currentLines.filter((l) => !(l.productId === productId && l.variantId === variantId));
    await cartRef.set({ lines: filtered });
    return filtered;
});
// ========== ADDRESS FUNCTIONS ==========
exports.getAddresses = functions.https.onCall(async (request) => {
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const addressesSnapshot = await db.collection('addresses').doc(userId).collection('items').get();
    const addresses = addressesSnapshot.docs.map((doc) => doc.data());
    const selectedIdDoc = await db.collection('userPreferences').doc(userId).get();
    const selectedAddressId = selectedIdDoc.exists ? selectedIdDoc.data()?.selectedAddressId : null;
    return { addresses, selectedAddressId };
});
exports.addAddress = functions.https.onCall(async (request) => {
    const data = request.data;
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const { address } = data;
    const addressId = generateId();
    const createdAt = new Date().toISOString();
    const newAddress = {
        ...address,
        id: addressId,
        createdAt,
        updatedAt: createdAt,
    };
    await db.collection('addresses').doc(userId).collection('items').doc(addressId).set(newAddress);
    return { address: newAddress };
});
// ========== ORDERS FUNCTION ==========
exports.getOrders = functions.https.onCall(async (request) => {
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const ordersSnapshot = await db
        .collection('orders')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    return ordersSnapshot.docs.map((doc) => doc.data());
});
// ========== MANUAL CATALOG SYNC ==========
exports.manualCatalogSync = functions.https.onCall(async (request) => {
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    console.log('[Firebase] Manual catalog sync triggered');
    try {
        const collections = [];
        let cursor = null;
        while (true) {
            const response = await queryStorefront(COLLECTIONS_QUERY, {
                first: PAGE_SIZE_MAX,
                after: cursor,
            });
            const { pageInfo, edges } = response.collections;
            for (const { node } of edges) {
                collections.push({
                    id: node.id,
                    name: node.title,
                    description: node.description,
                    imageUrl: node.image?.url,
                });
            }
            if (!pageInfo.hasNextPage || !pageInfo.endCursor)
                break;
            cursor = pageInfo.endCursor;
        }
        const categoryIds = new Set(collections.map((c) => c.id));
        const products = [];
        cursor = null;
        while (true) {
            const response = await queryStorefront(PRODUCTS_QUERY, {
                first: PAGE_SIZE_MAX,
                after: cursor,
            });
            const { pageInfo, edges } = response.products;
            for (const { node } of edges) {
                const collectionIds = node.collectionEdges
                    .map((e) => e.node.id)
                    .filter((id) => categoryIds.has(id));
                const resolvedCategoryId = collectionIds[0] ?? 'uncategorized';
                const resolvedCategoryIds = collectionIds.length > 0 ? collectionIds : ['uncategorized'];
                products.push(mapProduct(node, resolvedCategoryId, resolvedCategoryIds));
            }
            if (!pageInfo.hasNextPage || !pageInfo.endCursor)
                break;
            cursor = pageInfo.endCursor;
        }
        console.log(`[Firebase] Loaded ${products.length} products`);
        const categoriesRef = db.collection('catalog').doc('meta').collection('categories');
        const existingCategories = await categoriesRef.get();
        const deleteBatch = db.batch();
        existingCategories.docs.forEach((doc) => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
        for (const category of collections) {
            await categoriesRef.doc(category.id).set(category);
        }
        const productsRef = db.collection('catalog').doc('meta').collection('products');
        const existingProducts = await productsRef.get();
        const productDeleteBatch = db.batch();
        existingProducts.docs.forEach((doc) => productDeleteBatch.delete(doc.ref));
        await productDeleteBatch.commit();
        for (const product of products) {
            await productsRef.doc(product.id).set(product);
        }
        await db
            .collection('catalog')
            .doc('stamp')
            .set({
            stamp: `manual-${Date.now()}`,
            generatedAt: new Date().toISOString(),
        });
        return { ok: true, categories: collections.length, products: products.length };
    }
    catch (error) {
        console.error('[Firebase] Catalog sync failed:', error);
        throw new functions.https.HttpsError('internal', 'Sync failed');
    }
});
// ========== PUSH NOTIFICATION FUNCTION ==========
exports.sendPushNotification = functions.https.onCall(async (request) => {
    const data = request.data;
    const { userId, token, title, body, data: notificationData, type } = data;
    try {
        let targetToken = token;
        if (!targetToken && userId) {
            const userDoc = await db.collection('userPushTokens').doc(userId).get();
            if (userDoc.exists) {
                targetToken = userDoc.data()?.token;
            }
        }
        if (!targetToken) {
            await db.collection('notificationQueue').add({
                title,
                body,
                data: notificationData,
                type,
                createdAt: new Date().toISOString(),
                status: 'pending',
            });
            return { ok: true, queued: true };
        }
        await admin.messaging().send({
            token: targetToken,
            notification: { title, body },
            data: { type: type || 'general', ...notificationData },
            android: { priority: 'high', notification: { channelId: 'default' } },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
        return { ok: true, sent: true };
    }
    catch (error) {
        console.error('[Firebase] Push notification error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send notification');
    }
});
// ========== REGISTER PUSH TOKEN ==========
exports.registerPushToken = functions.https.onCall(async (request) => {
    const context = request;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const userId = context.auth.uid;
    const data = request.data;
    const { token } = data;
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'Token is required');
    }
    await db.collection('userPushTokens').doc(userId).set({
        token,
        updatedAt: new Date().toISOString(),
    });
    return { ok: true };
});
// ========== SCHEDULED CATALOG SYNC ==========
// Note: Cloud Scheduler setup required in Firebase Console:
// 1. Go to Cloud Scheduler in Google Cloud Console
// 2. Create job: catalog-daily-sync
// 3. Schedule: 0 2 * * * (2 AM Bucharest = 23:00 UTC)
// 4. Target: HTTP
// 5. URL: https://us-central1-dacus-b40f9.cloudfunctions.net/manualCatalogSync
//# sourceMappingURL=index.js.map
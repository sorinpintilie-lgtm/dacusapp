import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'dacus-b40f9';
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
const OUTPUT_PATH = process.env.CATALOG_SNAPSHOT_OUTPUT || 'apps/mobile/src/data/catalogSnapshot.json';

const initFirebase = () => {
  if (admin.apps.length > 0) return admin.app();

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    const absolute = path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH);
    const serviceAccount = JSON.parse(fs.readFileSync(absolute, 'utf8'));
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

const main = async () => {
  initFirebase();
  const db = admin.firestore();

  const [categoriesSnapshot, productsSnapshot, stampDoc] = await Promise.all([
    db.collection('catalog').doc('meta').collection('categories').get(),
    db.collection('catalog').doc('meta').collection('products').get(),
    db.collection('catalog').doc('stamp').get(),
  ]);

  const categories = categoriesSnapshot.docs.map((doc) => doc.data());
  const products = productsSnapshot.docs.map((doc) => doc.data());
  const stamp = stampDoc.exists ? stampDoc.data()?.stamp ?? null : null;
  const generatedAt = stampDoc.exists ? stampDoc.data()?.generatedAt ?? new Date().toISOString() : new Date().toISOString();

  const payload = {
    source: 'firestore-snapshot',
    stamp,
    generatedAt,
    categories,
    products,
    hasMoreProducts: false,
    productsCursor: null,
  };

  const absoluteOutput = path.resolve(OUTPUT_PATH);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(payload)}\n`, 'utf8');

  console.log(`[snapshot] wrote ${categories.length} categories`);
  console.log(`[snapshot] wrote ${products.length} products`);
  console.log(`[snapshot] output ${absoluteOutput}`);
};

main().catch((error) => {
  console.error('[snapshot] failed');
  console.error(error);
  process.exitCode = 1;
});

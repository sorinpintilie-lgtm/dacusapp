const { initializeApp } = require('firebase-admin');
const { getFunctions, httpsCallable } = require('firebase-functions/v2');

initializeApp();

const functions = getFunctions();

async function test() {
  try {
    const getCatalog = httpsCallable(functions, 'getCatalog');
    const result = await getCatalog({ pageSize: 5 });
    console.log('✅ getCatalog works:', JSON.stringify(result.data, null, 2));
  } catch (e) {
    console.log('❌ getCatalog error:', e.message);
  }
}

test();

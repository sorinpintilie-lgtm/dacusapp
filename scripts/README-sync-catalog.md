# Manual Shopify → Firestore catalog sync

Rulează manual scriptul de mai jos ca să încarci tot catalogul din Shopify în Firestore.

## Script

```bash
node scripts/sync-shopify-catalog-to-firestore.mjs
# sau
npm run sync:catalog:firestore
```

## Env minim necesar

Varianta simplă:

```bash
STORE_DOMAIN=f4eb2c-ae.myshopify.com
PUBLIC_TOKEN=439a0bd1b198b0a2a0129b6a4efa52aa
FIREBASE_PROJECT_ID=dacus-b40f9
GOOGLE_APPLICATION_CREDENTIALS=/cale/catre/service-account.json
```

Varianta compatibilă:

```bash
SHOPIFY_STORE_DOMAIN=f4eb2c-ae.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=439a0bd1b198b0a2a0129b6a4efa52aa
FIREBASE_PROJECT_ID=dacus-b40f9
GOOGLE_APPLICATION_CREDENTIALS=/cale/catre/service-account.json
```

## Alternativ

Dacă nu folosești `GOOGLE_APPLICATION_CREDENTIALS`, poți seta:

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/cale/catre/service-account.json
```

## Ce face

- citește toate colecțiile din Shopify
- citește toate produsele din Shopify
- golește:
  - `catalog/meta/categories`
  - `catalog/meta/products`
- rescrie tot catalogul în Firestore
- actualizează `catalog/stamp`

## Observație

Scriptul rescrie catalogul complet. E gândit pentru sync manual controlat, nu incremental.

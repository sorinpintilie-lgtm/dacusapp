# Dacus.ro Mobile App Monorepo

This repository contains the Phase 1 foundation for the Dacus.ro standalone app:

- React Native mobile app (`apps/mobile`)
- Loyalty backend API (`apps/api`)

Architecture and product plan is documented in `plans/dacus-mobile-app-plan.md`.

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Environment setup

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Copy `apps/mobile/.env.example` to `apps/mobile/.env`
3. Fill all required values before starting services

### Firebase persistence (production recommendation)

Commerce endpoints can run with in-memory storage (default) or Firestore.

Set these API env values to enable Firestore:

- `FIREBASE_ENABLED=true`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (keep escaped newlines `\\n` in env)
- Optional: `FIREBASE_DATABASE_URL`, `FIREBASE_STORAGE_BUCKET`

If Firebase env is missing or `FIREBASE_ENABLED=false`, API falls back to in-memory storage (not suitable for production durability).

### Search index for large catalog (Typesense)

For large catalogs (10k+ products), enable pre-indexed search in API:

- `TYPESENSE_ENABLED=true`
- `TYPESENSE_HOST`
- `TYPESENSE_ADMIN_KEY`
- Optional: `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_COLLECTION`, `TYPESENSE_TIMEOUT_SECONDS`

Optional but recommended for production sync pipeline:

- `SHOPIFY_WEBHOOK_SECRET`
- `SYNC_SECRET`
- `APP_URL`

When enabled, use:

- `GET /search/products` for paged search/filter
- `GET /search/suggestions?q=...` for instant suggestions
- `POST /search/sync-products` with header `x-sync-secret`
- `POST /search/webhooks/products` for Shopify product webhooks
- `POST /search/register-product-webhooks` with header `x-sync-secret` (one-time helper)

For daily safety sync, schedule a cron job (Vercel/Railway/GitHub Actions/etc.) that calls:

- `POST /search/sync-products` with `x-sync-secret`

## Run services

### Backend API

```bash
npm run dev:api
```

Health check endpoint:

```text
GET http://localhost:4000/health
```

### Mobile app (Expo)

```bash
npm run dev:mobile
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
```

## Mobile release verification

Run automated mobile release checks from repository root:

```bash
npm run verify:mobile:release
```

This executes the mobile workspace checks from [`apps/mobile/package.json`](apps/mobile/package.json):

- TypeScript validation
- Unit tests
- Expo doctor validation
- iOS production bundle export
- Android production bundle export

Manual pre-submit QA checklist is documented in [`plans/mobile-release-checklist.md`](plans/mobile-release-checklist.md).


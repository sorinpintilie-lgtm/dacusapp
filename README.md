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


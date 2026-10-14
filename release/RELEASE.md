# Releasing Dacus.ro 1.0.0

Status as of 14 Oct 2026. Everything that can be checked from a computer passes; what's left needs a
phone, the store accounts, or a production deploy.

## Done and verified

- `npm run verify:mobile:release`: typecheck, 45 unit tests, iOS + Android bundles, Expo Doctor 21/21.
- API: 16 tests + an end-to-end login test against the Firebase Auth emulator; lint clean.
- `node scripts/smoke-api.mjs`: the live API answers, guest checkout returns a working Shopify checkout
  link (opened in a browser: the Dacus checkout page with the right product and price), account
  endpoints refuse anonymous requests.
- Web preview: browse, search, departments, add to cart, change quantity, remove + undo, guest checkout.
- Store config: permissions trimmed to what the app uses (notifications, Face ID, network), Android
  adaptive icon inside the safe zone, privacy/terms links and account deletion in Setări.
- Store texts, privacy answers and screenshots: `release/STORE-LISTING.md`, `release/store-assets/`.

## 1. Deploy the backend (required before release)

The app's account features depend on server fixes that are committed but **not deployed yet**
(profiles for accounts created in the app, account deletion, Firestore with the runtime credentials).

```bash
npm run firebase:deploy
```

Then check the live API:

```bash
curl https://europe-west1-dacus-b40f9.cloudfunctions.net/api/health
```

It must report `"storage":"firestore"` and `"auth":"firebase"`. If it says `memory`, accounts, carts and
orders are not being saved: set `DACUS_FIREBASE_ENABLED=true` (and the service-account keys) in the
functions environment, or check that the function's service account has Firestore access.

Finally `node scripts/smoke-api.mjs` should print `all passing`.

## 2. Test on real phones (needs you)

Install a build on one iPhone and one Android phone (`eas build --profile preview --platform all`),
then walk through `plans/mobile-release-checklist.md`. The flows only a phone can prove:

- [ ] Create an account, log out, log in again; close and reopen the app (still logged in)
- [ ] Add an address; cart survives a restart; place an order with a real card (or a 100% discount code)
- [ ] After paying, the app says "Comanda a fost plasată" and the cart is empty; after backing out of the
      payment page, the products are still in the cart
- [ ] Orders list shows the order; loyalty points appear after the order is fulfilled
- [ ] Push notification permission prompt appears once; a test push arrives
- [ ] Face ID / fingerprint login after enabling it in Setări
- [ ] Setări → Șterge contul removes the account (log in again fails)

## 3. Store accounts (needs you)

- Apple Developer Program (company account for "Dacus") and an App Store Connect app with bundle ID
  `ro.dacus.mobile`.
- Google Play Console developer account and an app with package `ro.dacus.mobile`.
- A review/test account for Apple App Review (create it in the app).

## 4. Build and submit

```bash
eas build --profile production --platform all
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

The first iOS build asks for your Apple ID to create certificates; the first Android build creates the
upload keystore on EAS (keep it — every later update must be signed with it). `eas.json` →
`submit.production` can hold the App Store Connect app id and the Play service-account key so later
submits run without prompts.

## Decisions for the business

- **Analytics consent default.** "Statistici anonime" starts switched on. Under GDPR, analytics that are
  linked to a person usually need opt-in. The app now respects the switch; whether it should start off is
  a legal call.
- **Loyalty points** are computed by the app's backend from orders placed in the app. Points for in-store
  or website orders need the POS / Shopify integration (`/loyalty/scan`, POS API keys) to be configured.

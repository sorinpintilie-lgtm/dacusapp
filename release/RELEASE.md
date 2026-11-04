# Releasing Dacus.ro 1.0.0

Status as of 3 Nov 2026: code finished and pushed, backend live, store builds made. What's left needs a
phone, a person signed in to the store consoles, or a business decision.

## Done and verified

- `npm run verify:mobile:release`: typecheck, 48 unit tests, iOS + Android bundles, Expo Doctor 21/21
  (Expo 57.0.31).
- API: 16 tests + an end-to-end login test against the Firebase Auth emulator; lint clean.
- `node scripts/smoke-api.mjs` against the live API: all passing. Guest checkout returns a working Shopify
  checkout link (checked in a browser: Dacus checkout page, right product and price).
- Web preview: browse, search, departments, add to cart, quantities, remove + undo, guest checkout,
  sign-up validation, Setări (privacy/terms links).
- Catalog refreshed from Shopify on 3 Nov (17,190 products, all 84 collections in 13 departments).
- Logins persist across app restarts on phones (Firebase React Native persistence, confirmed in the
  Android bundle); password reset and change go through Firebase; errors are in Romanian.
- Pushed to GitHub `master`.

## 1. Backend — deployed ✅

`npm run firebase:deploy`, run from the **main checkout** (the deploy reads `functions/.env`, which is
not in git). Live check:

```bash
curl https://europe-west1-dacus-b40f9.cloudfunctions.net/api/health   # "storage":"firestore","auth":"firebase"
node scripts/smoke-api.mjs                                           # all passing
```

## 2. Builds — done ✅

| Build | Profile | Link |
| --- | --- | --- |
| Android test APK (install directly on a phone; 4 Nov, tested on Android 15 and Android 9 emulators) | `preview` | https://expo.dev/accounts/sorinpintilie/projects/dacusapp/builds/3d3ceabf-afdd-41d4-8901-788e1e96db6f |
| Android Play bundle (AAB, versionCode 4) | `production` | https://expo.dev/accounts/sorinpintilie/projects/dacusapp/builds/e793d0a3-103e-4363-85af-87bb870870eb |
| iOS App Store build (1.0.0, build 68) | `production` | https://expo.dev/accounts/sorinpintilie/projects/dacusapp/builds/3a2e4e4b-75ea-4147-8551-0b40820f5636 |

Give testers the APK link, not the `.aab`: a phone cannot install a Play bundle. Anyone who installed the
app from Google Play must uninstall it before installing the APK (different signing key).

iOS was sent to App Store Connect (app id `6760350768`, now in `eas.json`), so it appears in TestFlight
once Apple finishes processing. Next releases: `eas build -p all --profile production` then
`eas submit -p ios --profile production`.

## 3. Test on real phones (needs you)

Install the Android APK (link above) or the TestFlight build, then:

- [ ] Create an account, close the app completely, reopen it: still logged in
- [ ] Log out and log in; "Ai uitat parola?" sends an email (check its language in the Firebase console →
      Authentication → Templates; set it to Romanian if needed)
- [ ] Add an address; place an order with a real card (or a 100% discount code)
- [ ] After paying, the app says "Comanda a fost plasată" and the cart is empty; after backing out of the
      payment page, the products are still in the cart
- [ ] Orders list shows the order
- [ ] Push permission prompt appears once; Face ID / fingerprint login after enabling it in Setări
- [ ] Setări → Schimbă parola works; Setări → Șterge contul removes the account (logging in again fails)

## 4. Store submission (needs you, in the store consoles)

**App Store Connect** (app `6760350768`): pick build 68 for version 1.0.0, paste the texts from
`STORE-LISTING.md`, upload `store-assets/ios-6.9/`, fill App Privacy from the table there, add a review
account (create it in the app), submit for review.

**Google Play Console**: create the app `ro.dacus.mobile` if it doesn't exist, then upload the AAB above
by hand (Google requires the first upload in the console), add the listing texts, screenshots
(`store-assets/android-phone/`) and feature graphic, complete Data safety and the content rating, and
roll out to internal testing → production. For automatic uploads later, create a Play service account
key and add it to `eas.json` → `submit.production.android.serviceAccountKeyPath`.

## Decisions for the business

- **Analytics consent default.** "Statistici anonime" starts switched on. Under GDPR, analytics linked to
  a person usually need opt-in. The app respects the switch; whether it should start off is a legal call.
- **Loyalty points** are computed from orders placed in the app. Points for in-store or website orders
  need the POS / Shopify integration (`/loyalty/scan`, POS API keys).

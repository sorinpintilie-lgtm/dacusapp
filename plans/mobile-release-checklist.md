# Mobile Release Checklist (Dacus)

Use this checklist before each production EAS build.

## 1) Automated verification

- [ ] Run `npm run verify:mobile:release` from repository root
- [ ] Confirm no failures in typecheck, tests, doctor, iOS export, Android export

## 2) Build hygiene

- [ ] Increment/build with correct production profile in `eas.json`
- [ ] Use a fresh build cache when troubleshooting startup issues
- [ ] Confirm correct app config source (`app.json`) and required env values

## 3) Critical startup checks

- [ ] Cold launch from terminated state
- [ ] Confirm splash transitions to first screen (no white/black screen)
- [ ] Confirm fallback error UI appears if startup fails (no silent crash)

## 4) Core product flows

- [ ] Login flow works
- [ ] Register flow works
- [ ] Product search and filters work
- [ ] Product details load and add-to-cart works
- [ ] Cart update/remove/undo works
- [ ] Checkout handoff URL opens correctly
- [ ] Account segmented tabs render and actions work
- [ ] Loyalty screen loads QR and voucher actions render

## 5) Data and API resilience

- [ ] API timeout and offline handling messages are shown correctly
- [ ] App remains usable when API is slow/unavailable
- [ ] Session restore works after app relaunch

## 6) Release candidate validation

- [ ] Install on at least one iOS device and one Android device
- [ ] Validate performance on first launch and second launch
- [ ] Verify no blocking errors in device logs

## 7) Go/No-Go

- [ ] All automated checks pass
- [ ] All critical manual flows pass
- [ ] No startup black/white screen regressions
- [ ] Approved for submit

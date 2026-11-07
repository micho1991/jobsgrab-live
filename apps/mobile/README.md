# Mobile app (iOS and Android)

Expo SDK 58 / React Native 0.88, using the same Supabase backend and the same validation rules (`@hr/shared`) as the website.

**Candidates:** register, sign in (email or Google), reset password, browse jobs, apply with document uploads, track applications, open/replace documents, see interviews, get updates (live badge via Supabase Realtime), edit profile, request data deletion.
**HR staff:** overview by stage, searchable applications, application detail with stage changes, notes and audited document access. Scheduling interviews, positions, team and privacy requests stay on the web dashboard.

Sessions are stored in the iOS Keychain / Android Keystore (`expo-secure-store`).

## Run it locally

```bash
cp .env.example .env          # set EXPO_PUBLIC_SUPABASE_URL / ANON_KEY (for local Supabase use your computer's LAN IP, not localhost)
pnpm --filter @hr/mobile start
```

Scan the QR code with the Expo Go app for a quick look. **Google sign-in needs a development build** (Expo Go uses its own `exp://` URL scheme, not `hrrecruit://`). Email sign-in, applying and everything else work in Expo Go.

## One-time setup

1. **Supabase redirect URL.** Authentication → URL Configuration → add `hrrecruit://auth/callback`. Google sign-in on the phone returns through it.
2. **App identifiers.** In `app.json` replace `com.acme.careers` (iOS `bundleIdentifier`, Android `package`), the app name, and the icons in `assets/` with your own. Bundle IDs can't change after the first store release.
3. **Expo account and EAS.**
   ```bash
   npm i -g eas-cli
   eas login
   eas init                      # links the project to your Expo account
   eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_SITE_URL --value https://careers.yourcompany.com --visibility plaintext
   eas env:create --environment production --name EXPO_PUBLIC_COMPANY_NAME --value Acme --visibility plaintext
   ```
   Repeat for the `preview` environment. These values are public by design (the anon key is safe to ship; Row-Level Security protects the data). Never put the service-role key in the app.

## Build and test on real phones

```bash
eas build --profile preview --platform android   # installable .apk link for testers
eas build --profile preview --platform ios       # needs an Apple Developer account; registers test devices
```

Before release, check on a real iPhone and Android phone: the document picker (Files / Google Drive), Google sign-in returning to the app, staying signed in after closing the app, and opening documents.

## Publish to the stores

```bash
eas build --profile production --platform all
eas submit --platform ios       # App Store Connect (Apple Developer Program, $99/year)
eas submit --platform android   # Google Play Console ($25 one-time); the first upload must be done manually in Play Console
```

Store listings need a privacy policy URL (`https://<your site>/privacy`), screenshots, and the data-safety / privacy questionnaire. The app collects name, email, phone, address and uploaded documents for recruitment, stores them encrypted in transit and at rest, doesn't track users and doesn't share data with third parties. App Store review will also check that account deletion can be requested in-app (Account → Delete your data).

## Checks

```bash
pnpm --filter @hr/mobile typecheck
pnpm --filter @hr/mobile export:native   # compiles the real iOS + Android bundles (Hermes bytecode)
```

`tests/e2e/mobile.e2e.js` drives the app's web build at phone size against the backend (30 checks).

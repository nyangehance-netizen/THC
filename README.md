# TMWRC — apps for migrant workers and the Resource Centre

Built for the **TUCTA Migrant Workers Resource Centre**. One codebase, four apps:

| App | For | Android | iOS |
|---|---|---|---|
| **TMWRC** | Migrant workers abroad: SOS with GPS, 2-tap reports, "I'm safe" check-ins, SMS fallback, messages from the Centre | ✓ | ✓ |
| **TMWRC Centre** | Call-centre staff: live SOS alarm, worker locations, call/SMS/WhatsApp, case status, messages to workers | ✓ | ✓ |

The same apps also run as websites on GitHub Pages: **https://nyangehance-netizen.github.io/THC/**
(GitHub Pages publishes the `docs/` folder. After editing anything in `web/`, run `python3 web/build.py`, which also refreshes `docs/app/`, and commit both.)

## Accounts: register and sign in with an emailed code

Both apps open on **Register / Sign in**. People type their email and receive a **6-digit code** (no passwords).

* **Workers** register with name + email, confirm the code, then fill in their details. Their details are stored online, so signing in on a new phone brings everything back. Once signed in, the app keeps working with no internet.
* **Centre staff** register in TMWRC Centre the same way. A new staff account waits until an existing staff member approves it under **Me → Staff requests**. Emails listed in the `staff_invites` table are approved automatically (the owner's email is listed).

### Two settings in the Supabase dashboard (project `thc`)

1. **Show the code in the email.** Authentication → Emails → Templates. In both **Confirm signup** and **Magic Link**, replace the body with:
   ```html
   <h2>Your TMWRC code</h2>
   <p>Enter this code in the app: <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>It expires in 1 hour. If you did not ask for it, ignore this email.</p>
   ```
   Subject for both: `Your TMWRC code`.
   Until this is done the email contains a link instead. The apps accept it: on the code screen, open **Got a link in the email instead of a code?** and paste the link (press and hold it in the email, Copy link). Do not tap the link itself.
2. **Send email to everyone.** Supabase's built-in email only reaches the project team's own addresses and only a few emails per hour. For workers and staff, add your own email sender under Authentication → Emails → SMTP Settings (for example Resend, Brevo or Zoho Mail, which have free plans).

## Folders

```
docs/       the public website (GitHub Pages): start page + docs/app/
web/        the apps (HTML/CSS/JS) + database setup (supabase-schema.sql) + web setup guide
mobile/     Capacitor project that wraps the web apps into Android and iOS apps
.github/    automatic builds on GitHub
```

## Getting the apps (no computer setup needed)

Every push to `main` builds all four apps on GitHub.

1. Open the **Actions** tab → **Build mobile apps** → the latest run.
2. Scroll to **Artifacts** and download:
   * `android-worker` → `TMWRC-worker-debug.apk`
   * `android-centre` → `TMWRC-centre-debug.apk`
   * `ios-worker`, `ios-centre` → iPhone builds (see below)

To build on demand: Actions → Build mobile apps → **Run workflow**.
To make a release with download links: create a tag such as `v1.0.0` (Releases → Draft a new release → new tag).

### Android
The `*-debug.apk` files install directly: send the file to the phone, open it, and allow "Install unknown apps" when asked.

For **Google Play** you need signed builds. Add these repository secrets (Settings → Secrets and variables → Actions) and the next build also produces `*-release.apk` and `*-release.aab`:

| Secret | What |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | your upload keystore, base64 encoded (`base64 -w0 release.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

Create a keystore once: `keytool -genkey -v -keystore release.keystore -alias thc -keyalg RSA -keysize 2048 -validity 10000`. Keep it safe; Play needs the same key for every update.

### iPhone (iOS)
Apple only lets signed apps run on iPhones. Without an Apple account the build gives:
* `*-simulator.zip` for testing in the iPhone Simulator on a Mac
* `*-unsigned.ipa`, ready to be signed

To put the apps on **TestFlight / App Store** you need an Apple Developer account (USD 99 per year). Then add these secrets and the build also makes `*-appstore.ipa`, which you upload with Apple's Transporter app:

| Secret | What |
|---|---|
| `IOS_CERTIFICATE_BASE64` | Apple Distribution certificate (.p12), base64 |
| `IOS_CERTIFICATE_PASSWORD` | password of the .p12 |
| `IOS_PROFILE_WORKER_BASE64` | App Store provisioning profile for `tz.or.tucta.tmwrc`, base64 |
| `IOS_PROFILE_CENTRE_BASE64` | App Store provisioning profile for `tz.or.tucta.tmwrccentre`, base64 |
| `IOS_TEAM_ID` | your 10-character Apple Team ID |

## Before going live

1. Set the real Centre phone numbers in `web/config.js`.
2. Set up the online database (steps in `web/README.md`) and put its URL and key in `web/config.js`. Without it each app runs in demo mode on its own, and the worker and Centre apps cannot reach each other.
3. App IDs are `tz.or.tucta.tmwrc` and `tz.or.tucta.tmwrccentre`. To change them, edit `mobile/scripts/prepare.mjs` before the first store upload.

## Building on your own computer (optional)

```
python3 web/build.py
cd mobile && npm install
node scripts/prepare.mjs worker        # or: centre
npx cap add android                    # or: ios (needs a Mac with Xcode)
node scripts/native-setup.mjs android
npx cap open android
```

# TMWRC — SOS and help app for migrant workers

Built for the **TUCTA Migrant Workers Resource Centre**.

Three linked parts, all using the same online database:

| File | Who uses it | What it does |
|---|---|---|
| `index.html` | Workers abroad (phone) | Register; press **SOS**; ask for help (unpaid wages, passport taken, abuse, health, contract, legal, return home); **check in** "I am safe"; send location by **SMS** when there is no internet. Swahili and English. Installs on the phone like an app. |
| `centre.html` | Resource Centre staff (phone) | **TMWRC Centre** app: live SOS alarm (sound, vibration, notification), alert feed, one-tap Call / SMS / WhatsApp / Map to the worker, case status (New → Helping → Resolved), **messages to the worker** with quick replies in Swahili, map of all workers, workers with no recent contact. Installs on the phone as its own app. |
| `dashboard.html` | Resource Centre staff (computer) | **Case Desk**: open SOS alerts first, help requests, map of workers' last positions, worker details, staff notes and status, list of workers with **no contact for 72 h+**, and a form to log cases that arrived by SMS or phone. |

## How the two apps are linked

1. Worker presses SOS or reports a problem in **TMWRC** → it appears in **TMWRC Centre** within seconds, with an alarm for SOS.
2. Staff open the case, call or message the worker, and set it to **Helping**.
3. The worker's TMWRC app shows "Centre is helping", and the staff message appears on the home screen. The worker can answer in the app.
4. Staff mark the case **Resolved** when done.

## How location works

* **GPS** gives the exact position (usually 5–30 m) and works **without internet**.
* The app sends the position with every SOS, help request and check-in, and once automatically when the worker opens the app (at most every 6 hours, only if they agreed at registration).
* The worker's **home address** (building, landmark) is saved at registration, so staff have it even if GPS fails.
* **Lost connection:**
  1. Messages wait on the phone and send by themselves when internet returns (the server records both the time pressed and the time received).
  2. The **"No internet?"** box opens a ready SMS to the Centre with name, passport, address, GPS coordinates and a map link. Staff paste that SMS into **Log SMS or phone case** and the coordinates are filled in automatically.
  3. The Case Desk flags workers whose last contact is older than `NO_CONTACT_HOURS`, with their last known position.

## Put it online (about 30 minutes)

1. **Settings** — open `config.js` and set `SMS_NUMBER`, `HOTLINE_NUMBER`, `WHATSAPP_NUMBER`, `EMAIL` to the Centre's real numbers.
2. **Database** — create a free project at supabase.com.
   * SQL Editor → paste `supabase-schema.sql` → Run.
   * Authentication → Providers → Email: turn **off** "Allow new users to sign up".
   * Authentication → Users → **Add user** for each staff member (email + password).
   * SQL Editor: `insert into staff (user_id, name) select id, 'Staff name' from auth.users where email = 'staff@example.org';`
   * Project Settings → API: copy the **Project URL** and **anon/publishable key** into `config.js`.
3. **Hosting** — upload everything in the `site` folder to any HTTPS host (Netlify, Cloudflare Pages, GitHub Pages, or the TUCTA website). HTTPS is required for GPS.
4. Share the link `https://your-site/index.html` with workers (pre-departure training is a good moment). On Android: menu → **Add to Home screen**. On iPhone: Share → **Add to Home Screen**.
5. Staff open `https://your-site/centre.html` on their phones, add it to the home screen as **TMWRC Centre**, and sign in. On a computer they can use `dashboard.html`.

Without step 2 the app runs in **demo mode**: data stays in one browser, with example cases on the Case Desk.

## Security and privacy

* Workers can only **send** data; they can never read anyone's records.
* Only accounts listed in the `staff` table can see or edit cases.
* Workers' consent to location sharing is recorded at registration.
* Personal data of migrant workers is sensitive. Agree a retention rule (for example, delete resolved cases after 2 years) and limit staff accounts.

## Next steps for a full native app

The web app works on any phone today. A native Android/iOS app (for example wrapping these files with Capacitor) would add:

* location updates in the **background**, even when the app is closed;
* SOS sent **automatically by SMS** without the worker pressing Send (Android);
* push notifications from the Centre to workers;
* an SMS gateway (e.g. Africa's Talking or Twilio) so SOS texts enter the Case Desk automatically instead of being pasted.

## Files

`index.html`, `dashboard.html` — pages · `styles.css` — design · `config.js` — settings · `api.js` — database link · `sw.js`, `manifest.json`, `icon-*.png` — installable/offline app · `supabase-schema.sql` — database · `build.py` — rebuilds `site/` after editing the pages.

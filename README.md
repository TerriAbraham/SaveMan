# SaveMan Consultant

A mobile app for Papua New Guinea that connects **clients** with **verified consultants** in business, finance, law, IT, agriculture, HR and health. Clients search, book and message consultants; consultants manage their bookings, services and hours; an **admin** verifies consultants and keeps the platform safe.

Built with Expo (React Native) and styled with NativeWind, using a design inspired by the PNG flag (black, red and gold). The logo is a feathered headdress with a tapa-pattern headband.

> **Data note:** all data goes through a **Node.js + Express REST API in `backend/`**, which acts as the app's **mock server**: it starts with the dummy accounts, consultants, bookings, messages and reviews from `src/data/`, and stores changes in SQLite (a local file on your PC, or Turso when hosted online). Every route checks the caller's role. The app keeps a copy **on the phone in SQLite** for offline use, and the login token in **`expo-secure-store`**. See [REST API](#rest-api) and [Limitations](#limitations).

---

## Features

### Clients
- **Find consultants:** search by name, service or location, filter by service category and town.
- **Map:** every verified consultant shown as a pin; tap a pin to open their profile.
- **Consultant profiles:** bio, qualifications and licences, services and prices, expertise, location map with directions, rating and reviews.
- **Book a session:** choose a service, in person / video / phone, a date in the next 14 days and a free time slot.
- **My bookings:** upcoming and past sessions, booking details, cancel an upcoming booking.
- **Reviews:** rate a session (1–5 stars + comment) once it has been completed.
- **Messages and calls:** chat with consultants (with unread badges), or tap Call on a profile or booking to open the phone dialer.
- **Profile:** edit profile photo (choose from photos or take one), name, phone and town.

### Consultants
- **Dashboard:** new requests (accept / decline), sessions ready to mark completed, upcoming sessions, history, earnings and rating.
- **Services:** add, edit and delete services (name, description, length, price).
- **Availability:** set working hours per weekday (up to 3 time blocks per day); clients only see free slots inside these hours.
- **Edit profile:** profile photo (choose from photos or take one), name, phone, title, category, bio, hourly rate, qualifications and licences, address and map pin (drag the pin or use current location).
- **Messages and calls:** reply to clients, or call them from a booking.

### Security (all roles)
- **Two-step verification (TOTP MFA)** with Google Authenticator or Microsoft Authenticator: 6-digit codes that change every 30 seconds. No SMS.
- **Required for admins and consultants:** the first login asks them to set up an authenticator before they can get in. **Optional for clients:** turn it on or off under *Profile → Security*.
- **Setup:** QR code (scan from another screen), an *Open in authenticator* link and a copyable setup key (for setting up on the same phone).
- **10 one-time recovery codes** for a lost phone. Make new ones, or move MFA to a new phone, under *Security*.
- **Turning it off** (clients only) needs the password and a current code.

### Admin
- **Overview:** number of users, consultants, bookings and reviews; bookings by status.
- **Verify:** check each applicant's qualifications and licences, then approve or reject. Only verified consultants are visible to clients.
- **Users:** search all clients and consultants, view their details and bookings, suspend or reactivate accounts.
- **Bookings:** every booking on the platform, searchable and filterable by status.
- **Reviews:** remove inappropriate reviews (and restore them). Removed reviews are hidden and no longer count towards ratings.
- **Categories:** add, rename and delete service categories (a category in use can't be deleted).

---

## Requirements

- **Node.js** 22.18+ or 24.3+ (odd-numbered versions such as 23 aren't supported by Expo SDK 58; the API uses Node's built-in TypeScript support)
- **Expo Go** app on your phone, the version for **SDK 58** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))
- Your PC and phone on the **same Wi-Fi network** (or use tunnel mode, below)

## Install

```bash
npm install
cd backend && npm install && cd ..
```

## Run the API

The app needs the API for logging in. In a **separate terminal**:

```bash
cd backend
npm start
```

It listens on port 4000 and prints your PC's network addresses. The first start creates `backend/data/saveman.db` with the demo accounts below, and a development encryption key in `backend/data/master.key` (both git-ignored). To start from scratch (MFA off for everyone): stop the server, run `npm run reset`, then `npm start`.

The app finds the API automatically on port 4000 of the PC running the Expo dev server. If it can't (tunnel mode, or the API runs elsewhere), create a `.env` file in the project root:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000   # your PC's address, as printed by npm start
```

**Windows:** the first time, allow Node.js through Windows Defender Firewall on *private networks*, or the phone can't reach port 4000.

**Keep it running:** `npm run forever` restarts the API if it ever stops (log in `backend/data/server.log`). On Windows, `npm run autostart` also starts it, hidden, every time you log in; `npm run autostart:remove` undoes that.

## Host the API online (free)

To let anyone use the app, not just phones on your Wi-Fi, host the API on **Render** (free web service) with its data in **Turso** (free online SQLite). A free Render service loses its files on every restart, which is why the database lives in Turso.

1. **Turso:** sign up at [turso.tech](https://turso.tech), create a database, then copy its **URL** (`libsql://…`) and create a **token** for it.
2. **GitHub:** push this project to a GitHub repository.
3. **Render:** sign up at [render.com](https://render.com) with GitHub, choose **New → Blueprint** and pick the repository. It reads `render.yaml`, creates `saveman-api` on the free plan, generates `MFA_MASTER_KEY`, and asks for `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Paste them in.
4. When it's live, open `https://<your-service>.onrender.com/api/health`. It should show `{"ok":true}`. The first start adds the demo accounts to Turso.
5. In the project root `.env`, set `EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com` and restart `npx expo start` (or rebuild).

The free service **sleeps after 15 minutes** without requests. The next request wakes it in about a minute, and the app shows *"Waking up the SaveMan server"* meanwhile. Before a demo, open the health link a minute early. Never change `MFA_MASTER_KEY` once set: existing authenticator setups would stop working.

## REST API

The API in `backend/` is the app's mock server: real HTTP routes, filled with the dummy data from `src/data/` on first start. Requests and replies are JSON. Send the session token as `Authorization: Bearer <token>`; routes marked *public* also work without one. Errors come back as `{ "error": { "code", "message" } }` with a matching status: `400` invalid input, `401` not logged in, `403` your role isn't allowed, `404` not found or not yours, `409` conflict (e.g. a slot was just taken).

**Authentication** (`backend/src/app.js`)

| Method | Route | Who | What |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create a client or consultant account and profile |
| POST | `/api/auth/login` | public | Email + password → session, or an MFA step |
| POST | `/api/auth/mfa/verify` | MFA step | 6-digit or recovery code → session |
| GET | `/api/auth/me` | signed in | Your full profile |
| POST | `/api/auth/logout` | signed in | End the session |
| GET/POST | `/api/mfa/status`, `/setup`, `/enable`, `/recovery-codes`, `/disable` | signed in | Two-step verification settings |

**Data (CRUD)** (`backend/src/resources.js`)

| Method | Route | Who | What |
|---|---|---|---|
| GET | `/api/users`, `/api/users/:id` | public | Consultants and reviewers; signed in: also the people you deal with; admin: everyone |
| PATCH | `/api/users/:id` | owner / admin | Your own profile; an admin sets `status` or `verification` |
| GET | `/api/users/:id/busy` | signed in | A consultant's booked times (no client details) |
| GET | `/api/services?consultantId=` | public | A consultant's services |
| POST, PATCH, DELETE | `/api/services`, `/api/services/:id` | consultant | Manage your own services |
| GET | `/api/categories` | public | Service categories |
| POST, PATCH, DELETE | `/api/categories`, `/api/categories/:id` | admin | Manage categories (not ones still in use) |
| GET | `/api/bookings`, `/api/bookings/:id` | signed in | Your bookings; admin: all |
| POST | `/api/bookings` | client | Request a session (the slot is re-checked) |
| PATCH | `/api/bookings/:id` | client / consultant | Client: `cancelled`. Consultant: `confirmed`, `declined`, `completed` |
| GET | `/api/reviews` | public | Visible reviews; admin: all |
| POST | `/api/reviews` | client | Review your completed booking, once |
| PATCH | `/api/reviews/:id` | admin | `{ "removed": true \| false }` to hide or restore |
| GET | `/api/conversations`, `/api/messages` | signed in | Your conversations and messages |
| POST | `/api/messages` | client / consultant | Message the other side (creates the conversation) |
| PATCH | `/api/conversations/:id` | participant | `{ "read": true }` |

Role checks run on the server (`allow('admin')` and ownership checks in `resources.js`), so a modified app can't get around them. The API reuses the app's own rules (`src/utils/booking-rules.ts`, `availability.ts`, `services.ts`, `categories.ts`) through a small loader (`backend/src/ts-paths.js`). Try it in a browser: <http://localhost:4000/api/categories>.

## Run the app

```bash
npx expo start
```

Then scan the QR code:
- **Android:** open Expo Go and tap *Scan QR code*.
- **iPhone:** scan it with the Camera app.

If the phone can't connect (common on university or office Wi-Fi), use a tunnel instead:

```bash
npx expo start --tunnel
```

With a tunnel the phone still has to reach the API, so set `EXPO_PUBLIC_API_URL` (above) to an address the phone can reach, such as your PC's address on a phone hotspot.

If something looks wrong after pulling new code, clear the bundler cache:

```bash
npx expo start --clear
```

## Demo accounts

The login screen has buttons that fill these in for you.

| Role | Email | Password | Notes |
|---|---|---|---|
| Client | `client@saveman.pg` | `client123` | Grace Kaupa, Port Moresby. Has upcoming and past bookings and messages. |
| Consultant | `consultant@saveman.pg` | `consult123` | Dr. Michael Kila, Business. Has new requests and a session ready to complete. |
| Admin | `admin@saveman.pg` | `admin123` | Full admin access. |

Other accounts for testing specific cases:

| Email | Password | Case |
|---|---|---|
| `ruth@example.pg` | `client123` | Suspended client (login is refused until an admin reactivates her) |
| `nathan@saveman.pg` | `consult123` | Consultant waiting for verification |
| `brian@saveman.pg` | `consult123` | Consultant whose verification was rejected |

You can also create new client or consultant accounts from **Create an account**. New consultants start as *waiting for verification*.

**Admin and consultant accounts need an authenticator app** the first time they log in (see [Testing two-step verification](#testing-two-step-verification-in-expo-go)). Clients log in with just a password unless they turn MFA on.

Booking dates in the dummy data are relative to today, so there are always upcoming requests and recent history to try out, whatever day you run the app.

## Suggested walkthrough

1. **Client:** search “tax”, open Joanne Tau, book a session, then message her.
2. **Consultant:** accept the new requests, mark the past session completed, add a service, add Saturday hours.
3. **Client:** leave a review on the completed session.
4. **Admin:** approve Nathan ToVue, remove the abusive review about Joanne Tau, suspend a user, add a category.
5. **Client:** Nathan now appears in search and on the map.

## Testing two-step verification in Expo Go

Install **Google Authenticator** or **Microsoft Authenticator** on your phone. Start the API (`cd backend && npm start`) and the app (`npx expo start`), and open the app in Expo Go.

**1. Required setup (admin or consultant)**
1. Log in as `admin@saveman.pg` / `admin123`. Instead of the dashboard you get *Set up two-step verification*.
2. Add the account to your authenticator. On the same phone, tap **Open in authenticator**, or tap **Copy key**, then in the authenticator choose *Enter a setup key*, paste it and pick *Time based*. If the authenticator is on another device, scan the QR code.
3. Type the 6-digit code the authenticator shows. It submits on the 6th digit.
4. You see 10 recovery codes. **Copy** or **Share** them somewhere safe, then tap *I’ve saved my codes, continue*. You’re on the admin dashboard.

**2. Login with a code**
1. Log out (Overview → Log out) and log in as the admin again.
2. Enter the current code from the authenticator. Wrong or expired codes are refused, and the same code can’t be used twice.

**3. Recovery code (lost phone)**
1. Log out, log in again, tap **Lost your phone? Use a recovery code**, and enter one of the saved codes (case and dash don’t matter).
2. You’re told how many are left. Using the same code again fails.
3. Under *Overview → Security and two-step verification* you can **Make new recovery codes** (needs an authenticator code) or **Move to a new phone** (needs password + code). Admins and consultants have no *Turn off*.

**4. Optional MFA (client)**
1. Log in as `client@saveman.pg` / `client123` (no code asked). Go to *Profile → Security → Turn on* and follow the same setup.
2. Log out and in again: now a code is asked.
3. *Profile → Security → Turn off* asks for your password and a code. After that, login is password-only again.

**5. Lockouts and rate limits**
- 5 wrong codes in a row lock MFA on that account for 15 minutes (even with the right code, and even from a new login).
- 5 wrong passwords lock the login for 15 minutes.
- Each IP address gets 20 login/sign-up attempts and 30 MFA requests per 15 minutes.

To repeat the setup from the start, stop the API, run `npm run reset` in `backend/` and start it again. Delete the old SaveMan entry from the authenticator too.

**Automated tests** cover the whole flow (enrolment, login, replay, expiry, recovery codes, lockouts, rate limits, disabling) and the RFC 6238 test vectors:

```bash
cd backend
npm test
```

### How it’s secured

- **TOTP** (RFC 6238: SHA-1, 6 digits, 30-second steps, ±1 step for clock drift), written with Node’s `crypto`. The last accepted step is remembered, so a code can’t be replayed.
- **Secrets** are encrypted with AES-256-GCM before they’re stored. Set `MFA_MASTER_KEY` (64 hex or 44 base64 characters) in production; in development a key is generated in `backend/data/master.key`.
- **Recovery codes** (10, about 49 bits each) are stored only as keyed hashes (HMAC-SHA256), and each works once.
- **Passwords** are hashed with scrypt. Unknown emails take as long to reject as wrong passwords, with the same error message.
- **Tokens:** after the password you get a short-lived, single-use MFA token (5 minutes to enter a code, 15 to finish setup), not a session. Sessions last 12 hours, and only token hashes are stored. Changing or turning off MFA signs out your other devices.
- **No hard-coded or SMS codes.** The server never sends a code anywhere; only the authenticator app can make them.

---

## Project structure

```
backend/                Node.js + Express REST API (mock server): auth, MFA, CRUD routes, role checks (SQLite / Turso)
  src/app.js            Routes, rate limits and lockouts
  src/totp.js           TOTP / HOTP and otpauth:// links
  src/security.js       Password hashing, secret encryption, tokens, recovery codes
  test/                 API and TOTP tests (npm test)
src/
  api/                  API client used by auth-context
  app/                  Screens (Expo Router: every file is a route)
    (auth)/             Welcome, login, sign-up, MFA verify and MFA setup
    client/             Client tabs + profile, booking, chat and review screens
    consultant/         Consultant tabs + booking, service editor, chat, edit profile
    admin/              Admin tabs + user detail, categories
  components/           Reusable UI (cards, buttons, empty states, maps, chat)
    ui/                 Basic building blocks (Button, TextField, SearchField, ...)
    maps/               Map components (.native.tsx for phones, .tsx web fallback)
  context/              App state: auth-context (users, login) and data-context (bookings, reviews, messages, categories)
  data/                 Dummy data and TypeScript types
  hooks/                Shared logic for screens (messages, booking and admin actions)
  utils/                Pure functions: availability slots, booking rules, search, formatting, maps
  constants/            Colours (palette.json), theme and navigation styles
tailwind.config.js      NativeWind design tokens (colours, type scale)
```

Key business rules live in plain functions so they're easy to read and test:
- `src/utils/booking-rules.ts`: when a booking can be accepted, declined, completed or reviewed
- `src/utils/availability.ts`: which time slots are free
- `src/context/data-context.tsx` / `auth-context.tsx`: every action checks the signed-in user's role before changing data

## Checks

```bash
npx tsc --noEmit     # type check
npx expo lint        # lint
npx expo-doctor      # Expo dependency/config check
cd backend && npm test   # API, MFA, CRUD and role-check tests
```

## Maps and API keys

Maps use `react-native-maps`, which is included in Expo Go: **no API key is needed to test in Expo Go** (Android shows Google Maps, iPhone shows Apple Maps).

A Google Maps API key is only needed for a standalone **Android** build made with EAS:
1. In Google Cloud Console, create a project and enable **Maps SDK for Android**.
2. Run an EAS build once, then copy the **SHA-1** fingerprint from expo.dev → your project → *Configure → Credentials*.
3. Create an API key restricted to Android apps, using your `android.package` name and that SHA-1.
4. Add it to the `react-native-maps` config plugin as `androidGoogleMapsApiKey` (keep it in `app.config.js` read from a `.env` file, not committed to git) and set `android.package` in `app.json`.

## Limitations

- **Offline is read-only.** The app reopens logged in (token in `expo-secure-store`) and shows the last data it loaded (SQLite via `expo-sqlite`; browser storage on web). Booking, messaging, reviews and profile changes need the server and show a message when offline; they aren't queued.
- **Updates every 30 seconds.** New bookings and messages from other phones appear on the next reload (every 30 s, or when the app comes back to the foreground), not instantly.
- **Profile photos stay on the phone that picked them.** Only the photo's local address is saved, so other phones show initials.
- To start over with fresh dummy data: stop the API, run `npm run reset` in `backend/`, start it again, and delete the app's data on the phone (or bump `DATA_VERSION` in `src/storage/local-store.ts`).
- **Demo passwords** are in `src/data/users.ts` so the API can seed the same accounts; the API stores them hashed.
- **Sessions last 12 hours.** When the phone is online after that, the app logs out and asks for the password again.
- **On your PC the API uses plain HTTP** over Wi-Fi. Hosted on Render it gets HTTPS. A real release also needs a secret `MFA_MASTER_KEY`, and a shared store (such as Redis) for rate limits if it runs on more than one server.
- No payments, notifications, password reset or photo uploads.
- Designed for light mode only.

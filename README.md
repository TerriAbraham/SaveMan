# SaveMan Consultant

A mobile app for Papua New Guinea that connects **clients** with **verified consultants** in business, finance, law, IT, agriculture, HR and health. Clients search, book and message consultants; consultants manage their bookings, services and hours; an **admin** verifies consultants and keeps the platform safe.

Built with Expo (React Native) and styled with NativeWind, using a design inspired by the PNG flag (black, red and gold). The logo is a feathered headdress with a tapa-pattern headband.

> **Data note:** this version runs entirely on the phone with **built-in dummy data held in memory**. There is no backend server or database in this repository, so any changes (new accounts, bookings, messages) reset when the app reloads. See [Limitations](#limitations).

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
- **Profile:** edit name, phone and town.

### Consultants
- **Dashboard:** new requests (accept / decline), sessions ready to mark completed, upcoming sessions, history, earnings and rating.
- **Services:** add, edit and delete services (name, description, length, price).
- **Availability:** set working hours per weekday (up to 3 time blocks per day); clients only see free slots inside these hours.
- **Edit profile:** name, phone, title, category, bio, hourly rate, qualifications and licences, address and map pin (drag the pin or use current location).
- **Messages and calls:** reply to clients, or call them from a booking.

### Admin
- **Overview:** number of users, consultants, bookings and reviews; bookings by status.
- **Verify:** check each applicant's qualifications and licences, then approve or reject. Only verified consultants are visible to clients.
- **Users:** search all clients and consultants, view their details and bookings, suspend or reactivate accounts.
- **Bookings:** every booking on the platform, searchable and filterable by status.
- **Reviews:** remove inappropriate reviews (and restore them). Removed reviews are hidden and no longer count towards ratings.
- **Categories:** add, rename and delete service categories (a category in use can't be deleted).

---

## Requirements

- **Node.js** 22.13+ or 24.3+ (odd-numbered versions such as 23 aren't supported by Expo SDK 58)
- **Expo Go** app on your phone, the version for **SDK 58** ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))
- Your PC and phone on the **same Wi-Fi network** (or use tunnel mode, below)

## Install

```bash
npm install
```

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

Booking dates in the dummy data are relative to today, so there are always upcoming requests and recent history to try out, whatever day you run the app.

## Suggested walkthrough

1. **Client:** search “tax”, open Joanne Tau, book a session, then message her.
2. **Consultant:** accept the new requests, mark the past session completed, add a service, add Saturday hours.
3. **Client:** leave a review on the completed session.
4. **Admin:** approve Nathan ToVue, remove the abusive review about Joanne Tau, suspend a user, add a category.
5. **Client:** Nathan now appears in search and on the map.

---

## Project structure

```
src/
  app/                  Screens (Expo Router: every file is a route)
    (auth)/             Welcome, login, sign-up
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
```

## Maps and API keys

Maps use `react-native-maps`, which is included in Expo Go: **no API key is needed to test in Expo Go** (Android shows Google Maps, iPhone shows Apple Maps).

A Google Maps API key is only needed for a standalone **Android** build made with EAS:
1. In Google Cloud Console, create a project and enable **Maps SDK for Android**.
2. Run an EAS build once, then copy the **SHA-1** fingerprint from expo.dev → your project → *Configure → Credentials*.
3. Create an API key restricted to Android apps, using your `android.package` name and that SHA-1.
4. Add it to the `react-native-maps` config plugin as `androidGoogleMapsApiKey` (keep it in `app.config.js` read from a `.env` file, not committed to git) and set `android.package` in `app.json`.

## Limitations

- **No backend or database.** All data is dummy data in memory and resets on reload. Accounts and passwords exist only on the device.
- **Not production security.** Passwords in the dummy data are stored in plain text, and there are no tokens or server-side checks. The app checks roles inside its own state code, but a real release needs a server that hashes passwords and enforces these rules.
- No payments, notifications, password reset or photo uploads.
- Designed for light mode only.

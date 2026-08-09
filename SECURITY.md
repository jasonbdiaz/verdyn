# Verdyn — Security Model

How user data and B-hyve credentials are handled across the web and iOS apps.

## What data exists

| Data | Sensitivity | Where it lives |
|---|---|---|
| B-hyve email + password | **Secret** | Transient only — used once to mint a token, then discarded. Never stored. |
| B-hyve session token (`orbit_api_key`) | **Secret (bearer)** | Web: sealed in an httpOnly cookie. iOS: in memory for the session. |
| Lawn profile (ZIP, soil, grass, zones) | Low / non-PII | Web: `localStorage`. iOS: `AsyncStorage`. Contains **no** credentials. |

The lawn profile deliberately contains no password, no token, and no precise
address — only a 5-digit ZIP and agronomic settings.

## Credential handling

- The password is sent **once** over HTTPS to `POST /api/bhyve/connect` (web) or
  used directly on-device (iOS) to call Orbit's `/session` endpoint.
- It is **never** logged, returned in a response, or written to storage. On iOS
  the password field is cleared from React state immediately after login.
- Only the resulting session token is retained.

## Token at rest (web)

The session cookie is **sealed with AES-256-GCM** (`lib/session.ts`) before being
set, then flagged `httpOnly`, `secure` (prod), `sameSite=lax`, `path=/`, 7-day
max-age. Sealing means a leaked cookie value — from a log, a backup, or a stolen
cookie jar — is useless without `VERDYN_SESSION_SECRET`. Tampering fails the GCM
auth tag and is rejected as "no session."

> **Deploy requirement:** set `VERDYN_SESSION_SECRET` (32+ random chars). Without
> it the app falls back to an ephemeral per-process key (safe, but tokens reset on
> restart) and logs a warning.

`POST /api/bhyve/disconnect` clears the cookie; the dashboard "Disconnect" button
calls it and wipes local profile state.

## API hardening

- **Rate limiting** (`lib/ratelimit.ts`): login is capped at 8 attempts / 10 min /
  IP to blunt credential stuffing; `/api/plan` at 60/min. (In-memory per instance —
  back with Redis for multi-instance deploys.)
- **Input validation** (`lib/validate.ts`): every route bounds body size (64 KB)
  and validates shape — ZIP is `^\d{5}$`, email is shape-checked, grass/soil/head
  IDs must be known enum members, zone count and precip rates are range-checked.
  The engine never sees unvalidated input.
- **Uniform auth errors**: login failures return the same message regardless of
  whether the email exists, to avoid account enumeration.

## Transport & headers

All upstreams (Orbit, Open-Meteo, Google Fonts) are HTTPS. `next.config.mjs` sets
a strict **Content-Security-Policy**, `Strict-Transport-Security` (HSTS, preload),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (+ CSP
`frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, a
locked-down `Permissions-Policy`, and disables `x-powered-by`.

## The unofficial Orbit API

Orbit publishes no public API. `packages/core/src/bhyve.ts` is intentionally thin
and defensive: every call is wrapped, failures surface as `BhyveError`, and the
surface is minimal (auth, list zones, run/stop). Breakage is treated as expected
and surfaced to the user rather than swallowed.

## Known limitations / future work

- Rate limiting is in-memory; move to a shared store for horizontal scaling.
- No multi-user accounts yet — profiles are per-device. A hosted account system
  would add server-side auth (sessions/JWT), encrypted token storage in a DB, and
  per-user authorization checks.
- iOS does not yet persist the B-hyve token; when it does, use the device secure
  enclave / Keychain (`expo-secure-store`), never AsyncStorage.

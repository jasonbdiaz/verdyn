# Rain Bird cloud-relay spike (Phase 0)

This is the **gate** for the Rain Bird integration. The plan front-loads it
because the cloud relay is the one genuinely uncertain piece: everything after it
(provider wiring, persistence, UI) is low-risk plumbing that parallels the proven
B-hyve seam.

## Why this exists

Verdyn's automated watering is a **serverless Vercel cron** that reaches B-hyve
through Orbit's cloud API from anywhere. Rain Bird's open integrations
([pyrainbird], [node-rainbird]) instead talk to the **LNK WiFi module's local IP
on the home LAN** — unreachable from a cron. We committed to **attempting the
cloud relay** so the architecture stays serverless (no per-home bridge agent).

The goal of the spike: **log in with an account email/password and obtain a
reusable token that can read controllers and start a zone — no browser, no LAN.**

## Two Rain Bird clouds (don't conflate them)

| Cloud | Host | Auth | Who has it |
|---|---|---|---|
| **IQ4** | `iq4server.rainbird.com` | OIDC (email/pw → bearer token) | Commercial / central control (IQ-series satellites) |
| **Consumer relay** | Rain Bird app "Relay Mode" server | unknown | Homeowners: ESP-TM2 / ESP-ME3 / TRU + LNK2 |

`iq4-spike.mjs` targets **IQ4** (the documented one). A typical homeowner likely
has the **consumer** stack, whose relay protocol is undocumented — the same
AES-SIP payload we already build in `web/lib/rainbird/sip.ts`, tunneled through
Rain Bird's server. Run the IQ4 spike first to learn which world the test account
lives in.

## Running it (needs a REAL account)

```sh
RB_EMAIL=you@example.com RB_PASSWORD=… node spikes/rainbird/iq4-spike.mjs
```

Prints each OIDC hop, the captured access token (truncated), and the satellite
list. No secrets are persisted; creds come from env only.

## Status: BLOCKED on a real Rain Bird account

There is no test hardware/account on hand, so the spike **cannot pass yet** — and
neither can the rest of the Rain Bird run path, which depends on its findings.
What is already built and verified WITHOUT hardware:

- `packages/core/src/controllers/*` — provider-neutral abstraction (B-hyve adapted).
- `web/lib/rainbird/sip.ts` + tests — the AES-SIP command/crypto layer (the
  transport-agnostic payload), proven against the published protocol.

## The gate's outcome must answer

1. **Which cloud** does the target hardware use — IQ4 or consumer relay?
2. The exact **auth** call and the **run-zone** call (start station N for M min).
3. **Token-only reuse:** can a saved token drive runs unattended (like B-hyve)?
   - ⚠️ If only the password can re-auth, that collides with Verdyn's invariant —
     **we never persist passwords.** Stop for a product decision before building
     the persistence/cron path.

## To investigate the consumer relay (if IQ4 isn't it)

Use pyrainbird's `examples/mitm_rainbird.py` to capture the Rain Bird app's
Relay-Mode traffic: find the relay host + the envelope that wraps the AES-SIP
blob, then point `web/lib/rainbird/provider.ts`'s transport at it (the `sip.ts`
payload is already correct).

[pyrainbird]: https://github.com/allenporter/pyrainbird
[node-rainbird]: https://github.com/bbreukelen/node-rainbird

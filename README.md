# Verdyn 🌱

**Open-source, agent-native irrigation for the smart controller you already own.**

Verdyn turns a consumer WiFi sprinkler controller (Orbit B-hyve today; more brands staged in the
catalog) into an explainable, weather-driven irrigation system: seasonal ET scheduling, soil-aware
cycle-and-soak, local watering-restriction compliance, live rain/wind gates at the moment a valve
opens — and a plain-English **why** attached to every decision.

It grew out of a real system that has been autonomously watering the developer's backyard putting
green since 2026, and every drop of that agronomy is in this repo.

> **This repository is the whole product.** Clone it and run everything yourself — the engine, the
> web app, the unattended executor, and the MCP server. There is nothing to buy and nothing to sign
> up for. Your controller credentials never leave your infrastructure.

## Run it yourself

```bash
git clone https://github.com/jasonbdiaz/verdyn
cd verdyn && npm install
cp web/.env.example web/.env.local     # fill in what you need — everything is optional
npm run dev -w @verdyn/web             # http://localhost:3000
```

No database configured? The engine still runs fully in-browser. Add `DATABASE_URL` (Neon or any
Postgres) to unlock accounts, persistence, the automated executor, and the MCP endpoint; apply the
schema with `DATABASE_URL=… node web/scripts/migrate.mjs`. Self-host guide:
[verdyn.app/docs/self-host](https://verdyn.app/docs/self-host).

## Your B-hyve password is never stored

The basic (non-agentic) way to use Verdyn is a single Orbit sign-in — and the code is written so
that sign-in leaves nothing sensitive behind. This is a design guarantee you can verify in the
source, not a promise on a marketing page:

- **The password is used once, then discarded.** It's sent a single time to mint an Orbit session
  token and is never logged, never returned in a response, and never written to storage
  (`web/app/api/bhyve/connect/route.ts`, `packages/core/src/bhyve.ts`). On the iOS app the field is
  cleared from React state immediately after login.
- **Only the session token is kept, and it's sealed at rest.** The token lives in an `httpOnly`,
  `secure`, `sameSite` cookie **encrypted with AES-256-GCM** before it's ever set
  (`web/lib/session.ts`). A leaked cookie — from a log, a backup, a stolen cookie jar — is useless
  without your server's `VERDYN_SESSION_SECRET`.
- **The lawn profile holds no secrets.** ZIP, soil, grass, and zones — no password, no token, no
  precise address.
- **Disconnect means gone.** `POST /api/bhyve/disconnect` drops both the cookie and the persisted
  link that powers automated watering.

Read [`SECURITY.md`](SECURITY.md) for the full data-handling model.

## Agent-native (MCP)

Verdyn ships a dependency-free, stateless **Model Context Protocol server**
(`web/app/api/mcp/[token]/route.ts` — the whole protocol surface in one readable file). Point Claude,
ChatGPT, or any MCP client at your instance and manage your watering program by conversation
— get the plan, tune a zone, pause automation. Every tool is scoped to the caller's own account and
validated the same way the web app validates. Agent guide:
[verdyn.app/docs/agent](https://verdyn.app/docs/agent).

**No private data is shared or stored by the agent connection.** An agent reads only its own
account's lawn data (the same things the dashboard shows), the server stores no prompts or
transcripts (only the key's last-used timestamp), keys are stored as SHA-256 hashes and are
revocable instantly, and nothing is ever pushed to a model provider or used for training —
your assistant pulls from the endpoint only when you ask it to.

## Layout

npm-workspaces monorepo:

- **`packages/core`** — the engine. Pure TypeScript, zero UI/node-only deps (it bundles for the
  Expo app): agronomy database, ET + climate, scheduling/cycle-and-soak, restriction policies,
  recovery curves, anomaly detection, savings math, execution safety gates, controller catalog +
  provider abstraction, B-hyve client.
- **`web`** — Next.js app: the informational site, the dashboard, the API, the unattended cron
  executor, and the **MCP server**.
- **`mobile`** — Expo iOS app running the same engine on-device.

## Verify a change

```bash
npm run typecheck -w @verdyn/core && npm run typecheck -w @verdyn/web
npx tsx --test packages/core/src/**/*.test.mjs
npm run build -w @verdyn/web
```

## Safety model

This software opens real valves. Read [`SECURITY.md`](SECURITY.md) before pointing it at hardware.
The short version: restriction windows are hard-gated at execution time (not just plan time), live
weather is re-checked before every run, all runs are idempotently ledgered, controller passwords
are used once to mint a session token and never stored, and a failed weather pull **fails open**
for establishing turf — missing data never silently cancels irrigation, and never silently starts
it outside a legal window either.

## Status & contributing

B-hyve is the live integration; the catalog tracks ~20 more brands with a waitlist. The Rain Bird
cloud-relay spike lives in `spikes/`. Issues and PRs welcome — especially controller providers
(see `packages/core/src/controllers/`) and region restriction policies (`restrictions.ts`).

A fully-managed hosted option is coming later; for now, self-hosting from this repo is the way to
run Verdyn.

Not affiliated with Orbit®, B-hyve®, or any controller manufacturer. MIT licensed.

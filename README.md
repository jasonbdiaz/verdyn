# Verdyn 🌱

**Agronomy-grade lawn irrigation for the smart controller you already own — open source, agent-native.**

Verdyn turns a consumer WiFi sprinkler controller (Orbit B-hyve today; more brands staged in the
catalog) into an explainable, weather-driven irrigation system: seasonal ET scheduling, soil-aware
cycle-and-soak, local watering-restriction compliance, live rain/wind gates at the moment a valve
opens — and a plain-English **why** attached to every decision.

It grew out of a real system that has been autonomously watering the developer's backyard putting
green since 2026, and every drop of that agronomy is in this repo.

## Three ways to run it

| | |
|---|---|
| **Open source** | Clone this repo, self-host everything. Your credentials never leave your servers. → `web/.env.example` + [self-host guide](https://verdyn.app/docs/self-host) |
| **Expert · Agentic** | Free hosted account at [verdyn.app](https://verdyn.app). Every account gets a personal **MCP endpoint** — connect Claude, ChatGPT, or any MCP client and manage your watering program by conversation. → [agent guide](https://verdyn.app/docs/agent) |
| **Managed** | We set everything up and keep it tuned. [hello@verdyn.app](mailto:hello@verdyn.app) |

## Layout

npm-workspaces monorepo:

- **`packages/core`** — the engine. Pure TypeScript, zero UI/node-only deps (it bundles for the
  Expo app): agronomy database, ET + climate, scheduling/cycle-and-soak, restriction policies,
  recovery curves, anomaly detection, savings math, execution safety gates, controller catalog +
  provider abstraction, B-hyve client.
- **`web`** — Next.js app: marketing site, onboarding, dashboard, API, unattended cron executor,
  and the **MCP server** (`app/api/mcp/[token]/route.ts` — a dependency-free, stateless
  streamable-HTTP implementation you can read in one sitting).
- **`mobile`** — Expo iOS app running the same engine on-device.

## Quick start

```bash
git clone https://github.com/jasonbdiaz/verdyn
cd verdyn && npm install
cp web/.env.example web/.env.local     # fill in what you need — everything is optional
npm run dev -w @verdyn/web             # http://localhost:3000
```

No database configured? The engine still runs fully in-browser. Add `DATABASE_URL` (Neon or any
Postgres) to unlock accounts, persistence, the automated executor, and the MCP endpoint; apply the
schema with `DATABASE_URL=… node web/scripts/migrate.mjs`.

Verify a change:

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

Not affiliated with Orbit®, B-hyve®, or any controller manufacturer. MIT licensed.

# Verdyn — Security Log

Append-only record of /lockdown passes: findings, severity, and outcome. Read this
first on the next pass so we get smarter, not repetitive.

---

## 2026-08-09 — Full security audit (2nd pass, post open-source)

Scope: whole monorepo (`web/`, `mobile/`, `packages/core`, `spikes/rainbird`, `brand/`),
live site https://verdyn.app, and the public GitHub repo. Two prior fixes from the
first pass (deps + MCP rate cap) already shipped in `b4c02df`.

### Fixed + verified (this pass)

- **HIGH — Cancel didn't stop the cron from watering.** `POST /api/subscription/cancel`
  only cleared the browser cookie and stopped today's zones; it never deleted the
  persisted `bhyve_links` row (sealed Orbit token + `auto_run`) that the 15-min cron
  (`/api/cron/run` → `execute.ts:runAccount`) reads. Because entitlements never lapse
  (open-source product, `current_period_end` NULL = never-expiring), that row is the
  ONLY real kill switch — so a user who "cancelled" kept getting automatic watering,
  contradicting the route's own promise. **Fix:** resolve `currentAccountId()` +
  `deleteBhyveLink(accountId)`, mirroring `/api/bhyve/disconnect` and `/api/account/reset`.
- **HIGH (config-conditional) — magic-link `devLink` could leak in prod.**
  `/api/auth/request` returned a working single-use sign-in link in the JSON body when
  no email provider was configured (`devFallback && !emailConfigured()`). On a self-host
  or prod deploy that forgets `RESEND_API_KEY`, that's a full auth bypass for any email.
  Verified live it is NOT currently leaking (prod has the key → `{"ok":true}`), but
  **fix:** also gate on `process.env.NODE_ENV !== "production"` so a forgotten key can
  never become an account-takeover primitive. Standing rule: never unset the email key in prod.
- **MED — `identify-head` (paid MiniMax vision) had no origin check.** Anonymous-by-design
  (onboarding), rate-limited 20/10min per IP, but distributed traffic could run up vision
  cost. **Fix:** reject a present-but-mismatched `Origin` (403) as defense-in-depth; still
  allows the same-origin UI and IP-capped headless clients.
- **LOW — cron secret compared with `===`.** Theoretical timing side-channel. **Fix:**
  length-checked `crypto.timingSafeEqual`.
- **LOW — `soil` field on property-create cast without enum validation** (`properties` POST).
  Own-row JSONB data-integrity gap, not exploitable. **Fix:** validate against `SOIL_TYPES`,
  fall back to `loam` — mirrors `validateProfile()`.

All five verified: `tsc --noEmit` clean, `npm run build` green, `npm test` 69/69 pass.
Committed (`2f17a81`) + pushed to GitHub.

### ⚠️ ESCALATED — awaiting owner deploy

**These fixes (and the first-pass fix `b4c02df`) are NOT confirmed live.** `verdyn.app`
is served by the Vercel project **`verdyn-web`** (not the similarly-named stale `web`
project). Git push does **not** reliably auto-deploy — the latest prod deployment
predates this commit. Production `vercel --prod` is intentionally blocked by the
auto-mode classifier without an explicit per-deploy go-ahead. **Owner action:** from
`/Users/jbd/verdyn` (already linked to `verdyn-web`, Root Directory = `web`) run:
`! vercel --prod --yes`  — then confirm `vercel ls verdyn-web` shows ● Ready and
re-probe: `curl -s -X POST https://verdyn.app/api/identify-head -H 'Origin: https://evil.example' -d '{"image":"x"}'`
should return `bad_origin` (403). Until deployed, the cancel kill-switch gap remains
live for any real user who cancels.

### INFO / accepted (no action)

- **Expo/RN dependency advisories (10 high / 9 moderate):** ALL confined to the mobile
  build toolchain (metro, expo-cli, image-size, @expo/*). `npm ls` confirms none reach the
  deployed web runtime. Accept; clear at the next Expo SDK bump. Do NOT `audit fix --force`.
- **`auth/verify` has no rate limit** — 256-bit random, SHA-256-hashed, single-use token;
  not practically brute-forceable. Noted only.
- **Sustained low-rate email-bombing** — `auth/request` per-email cap is 5/10min with no
  escalating lockout (~720/day ceiling to one victim). Acceptable for a self-serve product.

### ALL-CLEAR checklist (verified in code / live, not assumed)

- **Secrets:** no credential values in tracked files or git history (both commits scanned);
  `.gitignore` covers `.env`/`.env.*`/`.vercel` repo-wide; `web/.env.example` is placeholders
  only; `.next/static` bundle clean; mobile binary carries no embedded keys; rainbird/core
  pull creds from `process.env` only; no personal/business data, IPs, or webhook URLs committed.
- **GitHub repo:** public, but secret-scanning + push-protection + Dependabot alerts all ENABLED.
- **Live headers (verdyn.app):** CSP (`frame-ancestors 'none'`), HSTS w/ preload, X-Frame-Options
  DENY, nosniff, referrer-policy, restrictive permissions-policy, `x-powered-by` removed.
- **Session crypto (`lib/session.ts`):** AES-256-GCM, fresh 12-byte IV per seal, auth tag
  verified, safe ephemeral-key fallback.
- **SQL injection:** every store uses Neon tagged-template parameterization; no string concat.
- **IDOR:** all account-scoped queries key off the server-resolved sealed cookie, never client
  input; MCP token scoped to its own account, exposes no destructive/billing capability.
- **Auth:** magic-link tokens 256-bit, hashed, single-use (atomic UPDATE), 15-min TTL; agent
  `vdk_` keys 192-bit, hashed, re-mint revokes prior; cron fails closed if `CRON_SECRET` unset.
- **Cost-bearing routes rate-limited:** waitlist, identify-head, auto-run, properties, restrictions,
  bhyve/connect, account/reset, subscription/cancel, auth/request, mcp/[token].
- **No open redirect / SSRF / CORS wildcard / user enumeration / secret leakage in responses.**

Next pass: delta-only — re-probe touched surfaces + re-run the Expo audit against the next SDK.

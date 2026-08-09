-- Verdyn local water-restriction store.
-- RAG-style corpus, keyed by county, populated lazily during onboarding.
-- Idempotent: safe to run repeatedly (run via `node web/scripts/migrate.mjs`).

-- Counties — the canonical unit a restriction is tagged to.
CREATE TABLE IF NOT EXISTS counties (
  id          SERIAL PRIMARY KEY,
  fips        TEXT UNIQUE,            -- 5-digit county FIPS when known
  name        TEXT NOT NULL,
  state       TEXT NOT NULL,          -- 2-letter
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, state)
);

-- ZIP -> county resolution cache (so repeat ZIPs never re-resolve or re-call AI).
CREATE TABLE IF NOT EXISTS zip_county (
  zip         TEXT PRIMARY KEY,       -- 5-digit
  county_id   INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  city        TEXT,
  state       TEXT,
  resolved_by TEXT NOT NULL,          -- 'ai' | 'builtin' | 'geo'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The restriction document per county — the structured + plain-English payload.
-- One "current" doc per county (latest wins); history is kept by not deleting.
CREATE TABLE IF NOT EXISTS restriction_docs (
  id                        SERIAL PRIMARY KEY,
  county_id                 INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  source                    TEXT NOT NULL,          -- 'ai' | 'builtin'
  policy_id                 TEXT,                   -- maps to core RESTRICTION_POLICIES when builtin
  label                     TEXT NOT NULL,
  allowed_weekdays_odd      INTEGER[] NOT NULL DEFAULT '{}',
  allowed_weekdays_even     INTEGER[] NOT NULL DEFAULT '{}',
  ban_start                 INTEGER,                -- hour 0-23, null = no ban
  ban_end                   INTEGER,
  establishment_exempt_days INTEGER NOT NULL DEFAULT 0,
  summary                   TEXT NOT NULL,          -- plain-English, RAG-friendly
  confidence                TEXT,                   -- 'high' | 'medium' | 'low'
  needs_verification        BOOLEAN NOT NULL DEFAULT false,
  model                     TEXT,                   -- model that produced it
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restriction_docs_county_idx ON restriction_docs (county_id, created_at DESC);

-- Chunked text for future vector RAG. Embeddings are added later (when an
-- embedding model is wired) — stored as a float array so we stay decoupled from
-- any specific pgvector dimension until then.
CREATE TABLE IF NOT EXISTS restriction_chunks (
  id          SERIAL PRIMARY KEY,
  county_id   INTEGER NOT NULL REFERENCES counties(id) ON DELETE CASCADE,
  doc_id      INTEGER NOT NULL REFERENCES restriction_docs(id) ON DELETE CASCADE,
  chunk       TEXT NOT NULL,
  embedding   DOUBLE PRECISION[],     -- nullable until embeddings are generated
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restriction_chunks_county_idx ON restriction_chunks (county_id);

-- ── Accounts, billing & auth ────────────────────────────────────────────────
-- Identity is independent of the B-hyve session: a subscription attaches to an
-- account, not to a controller token.

CREATE TABLE IF NOT EXISTS accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,        -- stored lowercased
  account_type TEXT NOT NULL DEFAULT 'homeowner',  -- 'homeowner' | 'business'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill for accounts created before the Pro module existed.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'homeowner';

-- Pro (business) multi-property: each row is one managed address. The full lawn
-- config lives in `profile` (JSONB) so the engine plans each property
-- independently. propertyLimit is enforced at the API layer off the entitlement.
CREATE TABLE IF NOT EXISTS properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  address     TEXT,
  zip         TEXT,
  profile     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS properties_account_idx ON properties (account_id, created_at);

-- One entitlement per account — the single source of truth for access. Stripe
-- (web) and Apple/RevenueCat (iOS) webhooks both upsert THIS row; the apps only
-- read effective tier/caps from it (see core entitlements.ts).
CREATE TABLE IF NOT EXISTS entitlements (
  account_id          UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  tier                TEXT NOT NULL DEFAULT 'weather',   -- 'weather' | 'expert' | 'pro'
  status              TEXT NOT NULL DEFAULT 'none',       -- active|trialing|past_due|canceled|expired|none
  source              TEXT NOT NULL DEFAULT 'none',       -- stripe|apple|promo|none
  external_id         TEXT,                               -- Stripe sub id / Apple original_transaction_id
  stripe_customer_id  TEXT,                               -- for the billing portal
  property_limit      INTEGER,                            -- purchased Pro-band cap; NULL = tier default
  current_period_end  TIMESTAMPTZ,
  trial_end           TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill for existing deployments.
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS property_limit INTEGER;
-- Look up an account fast from a billing webhook by its external subscription id.
CREATE INDEX IF NOT EXISTS entitlements_external_idx ON entitlements (external_id);
CREATE INDEX IF NOT EXISTS entitlements_stripe_customer_idx ON entitlements (stripe_customer_id);

-- Magic-link auth: only a SHA-256 hash of the token is stored, never the token.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash  TEXT PRIMARY KEY,
  email       TEXT NOT NULL,              -- lowercased; account created on first verify
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_email_idx ON auth_tokens (email);

-- ── Automated watering execution ────────────────────────────────────────────
-- The product's core promise: Verdyn runs the plan on the user's controller
-- without anyone present. That needs three things an unattended cron can read:
-- a controller session token, the lawn profile, and an idempotent run ledger.

-- Per-account B-hyve controller link for unattended execution. Stores ONLY the
-- AES-256-GCM-sealed Orbit session token (see web/lib/session.ts) — NEVER the
-- raw password. On a 401 from Orbit the row flips to 'reauth_needed' and the
-- user is asked to reconnect; we cannot silently re-login without the password,
-- which is the point. `auto_run` is the per-account opt-in to actually energize
-- valves; clearing it pauses execution while keeping the link.
CREATE TABLE IF NOT EXISTS bhyve_links (
  account_id    UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  sealed_token  TEXT NOT NULL,                       -- AES-256-GCM sealed {token,userId}
  status        TEXT NOT NULL DEFAULT 'linked',      -- 'linked' | 'reauth_needed'
  auto_run      BOOLEAN NOT NULL DEFAULT true,
  last_ok_at    TIMESTAMPTZ,                          -- last successful Orbit call
  last_run_at   TIMESTAMPTZ,                          -- last cron execution touch
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bhyve_links_autorun_idx ON bhyve_links (auto_run, status);

-- Homeowner's persisted lawn profile. Pro (business) accounts keep profiles in
-- `properties`; a single-home account keeps its one profile here so the cron can
-- plan without the browser. `timezone` is an IANA zone captured client-side so
-- cycle times ("HH:MM" local) execute at the correct wall-clock hour.
CREATE TABLE IF NOT EXISTS home_profiles (
  account_id  UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  profile     JSONB NOT NULL,
  timezone    TEXT,                                   -- IANA, e.g. 'America/New_York'
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent ledger of executed (or deliberately skipped) cycles. The hourly
-- cron checks here before energizing a valve so it never double-fires a cycle on
-- a retry or overlapping run. `property_id` is '' for a homeowner's single lawn
-- (empty string, not NULL, so the UNIQUE constraint actually dedupes). Doubles
-- as the run history shown in the dashboard.
CREATE TABLE IF NOT EXISTS run_log (
  id           BIGSERIAL PRIMARY KEY,
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  property_id  TEXT NOT NULL DEFAULT '',
  zone_id      TEXT NOT NULL,
  run_date     DATE NOT NULL,
  cycle_time   TEXT NOT NULL,                          -- 'HH:MM' local
  minutes      NUMERIC,
  status       TEXT NOT NULL,                           -- ran|skipped_window|wind_skip|reauth_needed|error
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, property_id, zone_id, run_date, cycle_time)
);
CREATE INDEX IF NOT EXISTS run_log_account_idx ON run_log (account_id, run_date DESC);

-- ── Controller waitlist ─────────────────────────────────────────────────────
-- Pre-launch demand signal for controllers Verdyn doesn't support yet. A visitor
-- who owns a coming-soon brand (Rain Bird, Rachio, Hunter, a hose-bib timer, …)
-- can leave their email; `brand_slug` matches a CONTROLLER_CATALOG slug in core.
-- No account is required — these are anonymous prospects. One signup per
-- (email, brand) so a repeat submit is a harmless no-op. No emails are sent yet.
CREATE TABLE IF NOT EXISTS controller_waitlist (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  brand_slug  TEXT NOT NULL,
  source      TEXT,                                    -- 'web' | 'mobile'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, brand_slug)
);
CREATE INDEX IF NOT EXISTS controller_waitlist_brand_idx ON controller_waitlist (brand_slug);

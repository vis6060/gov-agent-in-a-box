-- app/db/00-init.sql
-- Bootstrap schema for Gov-Agent-in-a-Box
-- Idempotent: safe to re-run on an already-initialized DB.

-- =========================
-- Region schemas
-- =========================
CREATE SCHEMA IF NOT EXISTS us_east;
CREATE SCHEMA IF NOT EXISTS eu_central;

-- =========================
-- Shared enums
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority') THEN
    CREATE TYPE priority AS ENUM ('low','medium','high');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
    CREATE TYPE status AS ENUM ('submitted','in_review','approved','denied','escalated');
  END IF;
END $$;

-- =========================
-- Region-scoped: profiles
-- =========================
CREATE TABLE IF NOT EXISTS us_east.profiles (
  profile_id TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  dob        DATE,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  gov_id     TEXT
);

CREATE TABLE IF NOT EXISTS eu_central.profiles (LIKE us_east.profiles INCLUDING ALL);

-- =========================
-- Region-scoped: cases
-- =========================
CREATE TABLE IF NOT EXISTS us_east.cases (
  case_id      TEXT PRIMARY KEY,
  case_type    TEXT NOT NULL,
  submitted_by TEXT,
  priority     priority NOT NULL DEFAULT 'medium',
  status       status   NOT NULL DEFAULT 'submitted',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sla_due_at   TIMESTAMPTZ,
  CONSTRAINT cases_submitted_by_fkey
    FOREIGN KEY (submitted_by) REFERENCES us_east.profiles(profile_id)
);

-- Start with LIKE to copy columns/indexes/defaults; FKs are handled below.
CREATE TABLE IF NOT EXISTS eu_central.cases (LIKE us_east.cases INCLUDING ALL);

-- Ensure the FK on eu_central.cases points to eu_central.profiles (LIKE doesn't copy FKs)
DO $$
BEGIN
  -- Drop the FK if it exists (no error if missing)
  IF EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  n.nspname = 'eu_central'
      AND  t.relname = 'cases'
      AND  c.conname = 'cases_submitted_by_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE eu_central.cases DROP CONSTRAINT cases_submitted_by_fkey';
  END IF;

  -- Add the correct FK; ignore if already present
  BEGIN
    EXECUTE '
      ALTER TABLE eu_central.cases
      ADD CONSTRAINT cases_submitted_by_fkey
        FOREIGN KEY (submitted_by)
        REFERENCES eu_central.profiles(profile_id)
    ';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- =========================
-- Region-scoped: docs
-- =========================
CREATE TABLE IF NOT EXISTS us_east.docs (
  doc_id        TEXT PRIMARY KEY,
  department    TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  version       TEXT,
  effective_date DATE
);

CREATE TABLE IF NOT EXISTS eu_central.docs (LIKE us_east.docs INCLUDING ALL);

-- =========================
-- Public: token vault (reversible redactions)
-- =========================
CREATE TABLE IF NOT EXISTS public.token_vault (
  token_id   TEXT PRIMARY KEY,
  region     TEXT NOT NULL,
  plaintext  TEXT NOT NULL,
  expires_at TIMESTAMPTZ
);

-- =========================
-- Public: append-only audit log (hash-chain fields added later in app)
-- =========================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id        BIGSERIAL PRIMARY KEY,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor     TEXT,
  action    TEXT,
  region    TEXT,
  details   JSONB,
  prev_hash TEXT,
  this_hash TEXT
);

-- =========================
-- Public: telemetry for SLO dashboards
-- =========================
CREATE TABLE IF NOT EXISTS public.telemetry (
  ts                TIMESTAMPTZ NOT NULL,
  region            TEXT        NOT NULL,
  tool              TEXT        NOT NULL,
  latency_ms        INT,
  success           BOOLEAN,
  guardrail_blocked BOOLEAN,
  tokens_used       INT
);

-- =========================
-- (Optional) RLS placeholders — enable later once RBAC is wired
-- =========================
-- ALTER TABLE us_east.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE eu_central.profiles ENABLE ROW LEVEL SECURITY;
-- ... add policies after auth is implemented.

-- End of 00-init.sql

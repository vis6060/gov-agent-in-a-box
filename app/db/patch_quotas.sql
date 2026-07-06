-- Simple quotas by principal (user or role) and optional model
CREATE TABLE IF NOT EXISTS public.quota_policy (
  id BIGSERIAL PRIMARY KEY,
  principal TEXT NOT NULL,            -- e.g., 'admin@local' or 'role:reviewer'
  model TEXT,                         -- null means "any"
  window_seconds INT NOT NULL DEFAULT 3600,  -- rolling window
  max_requests INT,                   -- null = unlimited
  max_tokens INT                      -- optional; set null for now
);

-- Usage ledger (append-only; compact later if needed)
CREATE TABLE IF NOT EXISTS public.quota_usage (
  id BIGSERIAL PRIMARY KEY,
  principal TEXT NOT NULL,
  model TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  requests INT NOT NULL DEFAULT 1,
  tokens INT NOT NULL DEFAULT 0
);

-- Users & roles (demo-simple)
CREATE TABLE IF NOT EXISTS public.rbac_user (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','reviewer','operator'))
);

-- Unredaction request (dual-control)
CREATE TABLE IF NOT EXISTS public.unredact_request (
  id BIGSERIAL PRIMARY KEY,
  token_id TEXT NOT NULL,
  region TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|denied|break_glass
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT
);

-- Approvals (must be distinct approvers)
CREATE TABLE IF NOT EXISTS public.unredact_approval (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES public.unredact_request(id) ON DELETE CASCADE,
  approver TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, approver)
);

CREATE INDEX IF NOT EXISTS idx_unredact_req_status ON public.unredact_request(status);

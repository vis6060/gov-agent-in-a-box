-- HITL queue table
CREATE TABLE IF NOT EXISTS public.hitl_item (
  id               BIGSERIAL PRIMARY KEY,
  task_id          TEXT,                  -- trace/task ref from audit insertion
  trace_id         TEXT, 
  case_id          TEXT,
  region           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending|approved|denied|escalated
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to      TEXT,
  decided_at       TIMESTAMPTZ,
  decision         TEXT,                  -- approve|deny|escalate
  decision_comment TEXT,

  -- inspection payload
  original_text    TEXT,                  -- the user text before policy
  redacted_text    TEXT,                  -- after pre-policy redaction (if any)
  reasons          JSONB,                 -- policy reasons (e.g., ["pii_redacted"])
  redactions       JSONB                  -- [{label, value, token_id}]
);

CREATE INDEX IF NOT EXISTS idx_hitl_status_region ON public.hitl_item(status, region);
CREATE INDEX IF NOT EXISTS idx_hitl_created_at    ON public.hitl_item(created_at);
CREATE INDEX IF NOT EXISTS idx_hitl_item_trace_id    ON public.hitl_item(trace_id); 

-- Optional: actions history
CREATE TABLE IF NOT EXISTS public.hitl_action (
  id         BIGSERIAL PRIMARY KEY,
  item_id    BIGINT REFERENCES public.hitl_item(id) ON DELETE CASCADE,
  actor      TEXT,
  action     TEXT,                         -- assign|approve|deny|escalate|comment
  comment    TEXT,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  details    JSONB
);

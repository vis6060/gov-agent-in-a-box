-- 1) Ensure the column your API may query exists
ALTER TABLE public.hitl_item
  ADD COLUMN IF NOT EXISTS trace_id TEXT;

-- Backfill trace_id to match task_id for existing rows
UPDATE public.hitl_item
SET trace_id = COALESCE(trace_id, task_id)
WHERE trace_id IS NULL;

-- 2) Helpful indexes for lookups and freshness
CREATE INDEX IF NOT EXISTS idx_hitl_item_trace_id   ON public.hitl_item (trace_id);
CREATE INDEX IF NOT EXISTS idx_hitl_item_created_at ON public.hitl_item (created_at);

-- 3) Compatibility view so code that uses 'hitl_items' still works
CREATE OR REPLACE VIEW public.hitl_items AS
SELECT
  id,
  task_id,
  trace_id,
  region,
  status,
  created_at,
  assigned_to,
  decided_at,
  decision,
  decision_comment,
  original_text,
  redacted_text,
  reasons,
  redactions
FROM public.hitl_item;

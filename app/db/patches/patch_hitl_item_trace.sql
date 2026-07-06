ALTER TABLE public.hitl_item
  ADD COLUMN IF NOT EXISTS trace_id TEXT;

UPDATE public.hitl_item
SET trace_id = COALESCE(trace_id, task_id)
WHERE trace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hitl_item_trace_id   ON public.hitl_item (trace_id);
CREATE INDEX IF NOT EXISTS idx_hitl_item_created_at ON public.hitl_item (created_at);

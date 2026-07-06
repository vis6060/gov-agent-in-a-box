// app/web/src/lib/api.ts

// ---- Base API URL ----
// Set VITE_API_URL in app/web/.env if you need a different host/port.
// e.g. VITE_API_URL=http://localhost:8000
export const API: string =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

// Turn "/path" into "http://host/path", but pass through absolute URLs unchanged
function toAbs(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

// -------------------------
// Your existing helpers (kept intact)
// -------------------------
export async function apiGET<T= any>(url: string): Promise<T> {
  const res = await fetch(toAbs(url));
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function apiPOST<T= any>(
  url: string,
  body?: any,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(toAbs(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${toAbs(url)} failed: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json() as Promise<T>;
}

// -------------------------
// Convenience JSON fetcher used by typed helpers
// -------------------------
async function jsonFetch<T = any>(
  pathOrUrl: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(toAbs(pathOrUrl), {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // ignore if no JSON
  }
  if (!res.ok || (body && body.ok === false)) {
    const msg = (body && (body.error || body.detail)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

// -------------------------
// Types and typed API helpers for the Reviewer Dashboard
// -------------------------
export type HitlItem = {
  id: number;
  task_id?: string | null;
  trace_id?: string | null;
  region: string;
  status: string;
  created_at: string;
  decision?: string | null;
  assigned_to?: string | null;
  reasons?: string[];
  redactions?: any[];
  original_text?: string;
  redacted_text?: string;
};

export async function ping() {
  return jsonFetch("/health");
}

export async function submitTask(prompt: string, region: string, top_k = 3) {
  return jsonFetch("/v1/tasks", {
    method: "POST",
    body: JSON.stringify({ prompt, region, top_k }),
  });
}

export async function fetchQueue(
  status: "pending" | "approved" | "denied" | "escalated" = "pending",
  region?: string
) {
  const q = new URLSearchParams({ status });
  if (region) q.set("region", region);
  return jsonFetch<{ items: HitlItem[] }>(`/hitl/queue?${q.toString()}`);
}

export async function fetchItem(id: number) {
  return jsonFetch<HitlItem>(`/hitl/item/${id}`);
}

export async function decide(
  id: number,
  decision: "approve" | "deny" | "escalate",
  comment: string
) {
  return jsonFetch(`/hitl/item/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, comment }),
  });
}

export async function assign(id: number, reviewer: string) {
  return jsonFetch(`/hitl/item/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ reviewer }),
  });
}

export async function nudgeReviewer(reviewer: string, region: string, message: string) {
  return jsonFetch(`/nudges/reviewer`, {
    method: "POST",
    body: JSON.stringify({ reviewer, region, message }),
  });
}

export async function rollbackTrace(traceId: string, withinSec = 60) {
  const encoded = encodeURIComponent(traceId);
  return jsonFetch(`/trace/rollback/${encoded}?within=${withinSec}`, {
    method: "POST",
  });
}

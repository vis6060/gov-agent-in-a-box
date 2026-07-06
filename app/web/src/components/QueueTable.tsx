import React from "react";

export type HitlItem = {
  id: number;
  task_id?: string | null;
  trace_id?: string | null;                 // used by rollback
  region: string;
  status: string;
  created_at: string;                       // ISO
  decision?: string | null;
  assigned_to?: string | null;
  reasons?: string[];
  redactions?: Array<{ label: string; token_id: string }>;
  original_text?: string;
  redacted_text?: string;
};

type Props = {
  items: HitlItem[];
  reviewer: string;
  loadingIds: number[];
  onAssignToMe: (id: number) => void | Promise<void>;
  onComment: (id: number, comment: string) => void | Promise<void>;
  onDecide: (id: number, decision: "approve" | "deny" | "escalate") => void | Promise<void>;
  onRollback?: (item: HitlItem) => void | Promise<void>;   // optional
};

const AGE_ONLY_FALLBACK = true; // set false later if you want strict redaction-signal gating

function ageSeconds(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

function rollbackEligible(item: HitlItem) {
  const ageOk = ageSeconds(item.created_at) <= 60;
  const reasonFlag = Array.isArray(item.reasons) && item.reasons.some(r => /pii|redact/i.test(r));
  const tokenInText = typeof item.redacted_text === "string" && /\[\[TOKEN:/.test(item.redacted_text);
  const hasRedactions = Array.isArray(item.redactions) && item.redactions.length > 0;
  return ageOk && (hasRedactions || reasonFlag || tokenInText || AGE_ONLY_FALLBACK);
}

export default function QueueTable({
  items,
  reviewer,
  loadingIds,
  onAssignToMe,
  onComment,
  onDecide,
  onRollback,
}: Props) {
  const [comments, setComments] = React.useState<Record<number, string>>({});
  const setComment = (id: number, v: string) =>
    setComments((s) => ({ ...s, [id]: v }));

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Region</th>
            <th>Age (s)</th>
            <th>Reasons</th>
            <th>Assigned</th>
            <th style={{width: "32%"}}>Comment</th>
            <th style={{width: "36%"}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={7} style={{textAlign:"center", color:"#6b7280"}}>Empty</td></tr>
          ) : items.map((it) => {
              const busy = loadingIds.includes(it.id);
              const reasons = (it.reasons || []).join(", ") || "—";
              const eligible = rollbackEligible(it);
              const comment = comments[it.id] || "";
              return (
                <tr key={it.id}>
                  <td><b>#{it.id}</b></td>
                  <td>{it.region}</td>
                  <td>{ageSeconds(it.created_at)}</td>
                  <td>{reasons}</td>
                  <td>{it.assigned_to || "—"}</td>
                  <td>
                    <input
                      placeholder="Short note…"
                      value={comment}
                      onChange={(e) => setComment(it.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn" onClick={() => onAssignToMe(it.id)} disabled={busy} title={`Assign to ${reviewer}`}>Assign</button>
                      <button className="btn btn-primary" onClick={() => onDecide(it.id, "approve")} disabled={busy}>Approve</button>
                      <button className="btn btn-rose" onClick={() => onDecide(it.id, "deny")} disabled={busy}>Deny</button>
                      <button className="btn btn-amber" onClick={() => onDecide(it.id, "escalate")} disabled={busy}>Escalate</button>
                      <button
                        className="btn btn-amber"
                        onClick={() => onRollback && onRollback(it)}
                        disabled={!eligible || busy}
                        title="Undo over-redaction within 60s"
                      >
                        Rollback (60s)
                      </button>
                      <button
                        className="btn"
                        onClick={() => onComment(it.id, comment)}
                        disabled={busy || comment.trim().length === 0}
                      >
                        Comment
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

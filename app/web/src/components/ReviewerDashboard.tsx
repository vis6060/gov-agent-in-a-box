import React from "react";
import "./ui.css";
import { apiGET, apiPOST } from "../lib/api";
import QueueTable, { HitlItem } from "./QueueTable";

type DashboardResp = {
  ok: boolean;
  region: string;
  sla: {
    ok: boolean;
    pending: number;
    breaches: { id: number; region: string; wait_sec: number }[];
    target_minutes: number;
  };
  streaks: {
    ok: boolean;
    reviewers: { reviewer: string; streak_days: number; active_days_in_window: number }[];
  };
  pending: HitlItem[];
  my_queue: HitlItem[];
};

type Props = {
  baseUrl: string;     // "http://localhost:8000"
  reviewer: string;    // "rev1@local"
  region: string;      // "us_east"
};

export default function ReviewerDashboard({ baseUrl, reviewer, region }: Props) {
  const [data, setData] = React.useState<DashboardResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busyIds, setBusyIds] = React.useState<number[]>([]);
  const [prompt, setPrompt] = React.useState("My email is a.user@example.com. Please help.");
  const [submitRegion, setSubmitRegion] = React.useState(region);

  const refresh = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const d = await apiGET<DashboardResp>(
        `${baseUrl}/ui/reviewer_dashboard?region=${encodeURIComponent(region)}&reviewer=${encodeURIComponent(reviewer)}&limit=25`
      );
      setData(d);
    } catch (e:any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, region, reviewer]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // ---- Actions ----
  async function submitTask() {
    try {
      const body = await apiPOST(`${baseUrl}/v1/tasks`, { prompt, region: submitRegion, top_k: 3 });
      const lines:string[] = [];
      lines.push(`task_id: ${body.task_id}`);
      if (body.status) lines.push(`status: ${body.status}`);
      if (body.redacted_prompt) lines.push(`redacted_prompt: ${body.redacted_prompt}`);
      if (body.hitl_id) lines.push(`HITL enqueued: ${body.hitl_id}`);
      alert(lines.join("\n"));
      await refresh();
    } catch (e:any) {
      alert(e.message || String(e));
    }
  }

  async function assignToMe(id: number) {
    setBusyIds((s)=>[...s,id]);
    try {
      await apiPOST(`${baseUrl}/hitl/item/${id}/assign`, { assignee: reviewer }, { "X-Actor": reviewer });
      await refresh();
    } catch(e:any){ alert(e.message || String(e)); }
    finally { setBusyIds((s)=>s.filter(x=>x!==id)); }
  }

  async function addComment(id:number, comment:string) {
    setBusyIds((s)=>[...s,id]);
    try {
      await apiPOST(`${baseUrl}/hitl/item/${id}/comment`, { comment }, { "X-Actor": reviewer });
      await refresh();
    } catch(e:any){ alert(e.message || String(e)); }
    finally { setBusyIds((s)=>s.filter(x=>x!==id)); }
  }

  async function decide(id:number, decision:"approve"|"deny"|"escalate") {
    setBusyIds((s)=>[...s,id]);
    try {
      await apiPOST(`${baseUrl}/hitl/item/${id}/decision`, { decision, actor: reviewer });
      await refresh();
    } catch(e:any){ alert(e.message || String(e)); }
    finally { setBusyIds((s)=>s.filter(x=>x!==id)); }
  }

  async function rollback(item: HitlItem) {
    const traceId = item.trace_id || item.task_id;
    if (!traceId) { alert("Missing trace_id/task_id"); return; }
    setBusyIds((s)=>[...s,item.id]);
    try {
      const resp = await apiPOST(`${baseUrl}/trace/rollback/${encodeURIComponent(traceId)}?within=60`);
      alert(`Rollback applied.\n${JSON.stringify(resp, null, 2)}`);
      await refresh();
    } catch(e:any){ alert(e.message || String(e)); }
    finally { setBusyIds((s)=>s.filter(x=>x!==item.id)); }
  }

  const pending = data?.pending || [];
  const myQueue = data?.my_queue || [];
  const breaches = data?.sla?.breaches || [];

  return (
    <div className="page">
      <div className="header">
        <div className="title">Reviewer Dashboard</div>
        <div className="kicker">Region: <b>{region}</b> &nbsp;•&nbsp; Reviewer: <b>{reviewer}</b></div>
      </div>

      <div className="grid">
        {/* Left: submit & health & queue */}
        <div className="card">
          <h2>Submit Task</h2>
          <div className="row">
            <div className="k">Region</div>
            <select value={submitRegion} onChange={(e)=>setSubmitRegion(e.target.value)}>
              <option value="us_east">us_east</option>
              <option value="eu_central">eu_central</option>
            </select>
          </div>
          <div className="row">
            <div className="k">Prompt</div>
            <textarea rows={4} value={prompt} onChange={(e)=>setPrompt(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn btn-primary" onClick={submitTask}>Submit</button>
            <button className="btn" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
            <button className="btn btn-secondary" onClick={async ()=>{
              try{
                const resp = await apiPOST(`${baseUrl}/nudges/reviewer`, {
                  reviewer, region, message: "Friendly nudge: items breaching SLA are waiting."
                });
                alert(`Nudge sent.\n${JSON.stringify(resp,null,2)}`);
              }catch(e:any){ alert(e.message || String(e)); }
            }}>Nudge reviewer ({reviewer})</button>
          </div>

          <div className="section">
            <h3>HITL Queue (pending)</h3>
            {breaches.length>0 && (
              <div className="k" style={{marginBottom:8}}>
                <span className="badge" title="Items breaching SLA">SLA breaches: {breaches.length}</span>
              </div>
            )}
            <div className="queue">
              <QueueTable
                items={pending}
                reviewer={reviewer}
                onAssignToMe={assignToMe}
                onComment={addComment}
                onDecide={decide}
                onRollback={rollback}
                loadingIds={busyIds}
              />
            </div>
          </div>
        </div>

        {/* Right: my queue + guidance */}
        <div className="card">
          <h2>My Queue</h2>
          <div className="queue">
            <QueueTable
              items={myQueue}
              reviewer={reviewer}
              onAssignToMe={assignToMe}
              onComment={addComment}
              onDecide={decide}
              onRollback={rollback}
              loadingIds={busyIds}
            />
          </div>

          <div className="section">
            <h3>Tips</h3>
            <div className="code">
              • Fresh redacted items (≤60s) will enable <b>Rollback (60s)</b>.<br/>
              • Add a short note before approving/denying.<br/>
              • Use <b>Nudge</b> to ping reviewers when SLA breaches rise.
            </div>
          </div>
        </div>
      </div>

      {err && <div className="section"><div className="code" style={{borderColor:"#fecaca", background:"#fff1f2", color:"#7f1d1d"}}>Error: {err}</div></div>}
    </div>
  );
}

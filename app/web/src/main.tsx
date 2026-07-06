import React from "react";
import { createRoot } from "react-dom/client";
import ReviewerDashboard from "./components/ReviewerDashboard";

const API = "http://localhost:8000";

type HitlItem = {
  id: number;
  task_id: string | null;
  region: string;
  status: string;
  created_at: string;
  decision?: string | null;
  assigned_to?: string | null;
};

function useFetch<T>(url: string, deps: any[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [err, setErr] = React.useState<any>(null);
  React.useEffect(() => {
    let mounted = true;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (mounted) setData(d); })
      .catch(e => { if (mounted) setErr(e); });
    return () => { mounted = false; };
  }, deps);
  return { data, err };
}

function App() {
  const [status, setStatus] = React.useState<any>(null);
  const [task, setTask] = React.useState<string>("My email is a.user@example.com. How do I appeal?");
  const [region, setRegion] = React.useState<string>("us_east");
  const [selected, setSelected] = React.useState<number | null>(null);
  const [item, setItem] = React.useState<any>(null);
  const [comment, setComment] = React.useState<string>("");

  const reviewer = "rev1@local"; // used by the ReviewerDashboard

  async function ping() {
    const res = await fetch(`${API}/health`);
    setStatus(await res.json());
  }

  async function submit() {
    try {
      const res = await fetch(`${API}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: task, region, top_k: 3 })
      });
      const body: any = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body?.error || `HTTP ${res.status}`);
      const lines: string[] = [];
      lines.push(`task_id: ${body.task_id}`);
      if (body.status) lines.push(`status: ${body.status}`);
      if (body.status === "blocked") {
        const reasons = (body.reasons || []).join(", ");
        lines.push(`reasons: ${reasons || "—"}`);
      } else {
        if (body.redacted_prompt) lines.push(`redacted_prompt: ${body.redacted_prompt}`);
        const docs = (body.top_docs || [])
          .map((d: any) => `${d.doc_id} (${Number(d.score).toFixed(3)}) - ${d.title}`)
          .join("\n");
        lines.push("Top docs:");
        lines.push(docs || "—");
      }
      if (body.hitl_id) lines.push(`HITL enqueued: ${body.hitl_id}`);
      alert(lines.join("\n"));
      await refreshQueue();
    } catch (e: any) {
      alert(`Submit failed: ${e.message || e}`);
      console.error(e);
    }
  }

  async function refreshQueue() {
    // pulls pending for both regions if none selected
    const res = await fetch(`${API}/hitl/queue?status=pending`);
    const payload = await res.json();
    setQueue(payload.items || []);
  }

  const [queue, setQueue] = React.useState<HitlItem[]>([]);
  React.useEffect(() => { ping(); refreshQueue(); const id = setInterval(refreshQueue, 5000); return () => clearInterval(id); }, []);

  async function openItem(id: number) {
    const res = await fetch(`${API}/hitl/item/${id}`);
    const data = await res.json();
    setSelected(id);
    setItem(data);
    setComment("");
  }

  async function decide(decision: "approve" | "deny" | "escalate") {
    if (!selected) return;
    const res = await fetch(`${API}/hitl/item/${selected}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment })
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) {
      alert(`Decision failed: ${body.error || res.status}`);
      return;
    }
    alert(`HITL ${decision} saved`);
    setSelected(null);
    setItem(null);
    setComment("");
    await refreshQueue();
  }

  // crude highlight of token placeholders in redacted text
  function highlightTokens(text?: string) {
    if (!text) return "";
    return text.replace(/\[\[TOKEN:[^\]]+]]/g, (m) => `<mark>${m}</mark>`);
  }

  return (
    <div style={{padding: 24, fontFamily: "ui-sans-serif", background: "#f7f7f7", minHeight: "100vh"}}>
      <h1>Gov-Agent-in-a-Box</h1>

      {/* ====== Existing UI (unchanged) ====== */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap: 24}}>
        {/* Left: submit + health */}
        <div>
          <h2>Submit Task</h2>
          <div>
            <label>Region: </label>
            <select value={region} onChange={e=>setRegion(e.target.value)}>
              <option value="us_east">us_east</option>
              <option value="eu_central">eu_central</option>
            </select>
          </div>
          <textarea value={task} onChange={e=>setTask(e.target.value)} rows={6} style={{width:"100%", marginTop:8}}/>
          <div style={{marginTop:8}}>
            <button onClick={submit}>Submit Task</button>
          </div>
          <h3 style={{marginTop:16}}>API health</h3>
          <pre>{status ? JSON.stringify(status, null, 2) : "loading..."}</pre>
        </div>

        {/* Right: HITL queue */}
        <div>
          <h2>HITL Queue (pending)</h2>
          <button onClick={refreshQueue} style={{marginBottom:8}}>Refresh</button>
          <div style={{maxHeight: 300, overflowY: "auto", border:"1px solid #ddd", padding:8, background:"#fff"}}>
            {queue.length === 0 ? <div>Empty</div> : queue.map(item =>
              <div key={item.id} style={{borderBottom:"1px solid #eee", padding:"6px 0", cursor:"pointer"}} onClick={()=>openItem(item.id)}>
                <div><b>#{item.id}</b> • {item.region} • {item.status}</div>
                <div style={{fontSize:12, color:"#555"}}>{item.task_id || "tbd"} • {new Date(item.created_at).toLocaleString()}</div>
              </div>
            )}
          </div>

          {/* Item details */}
          {selected && item && (
            <div style={{marginTop:16, border:"1px solid #ddd", padding:8, background:"#fff"}}>
              <h3>Review Item #{selected}</h3>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <div>
                  <div style={{fontWeight:600}}>Original</div>
                  <pre style={{whiteSpace:"pre-wrap"}}>{item.original_text || "—"}</pre>
                </div>
                <div>
                  <div style={{fontWeight:600}}>Redacted</div>
                  <div dangerouslySetInnerHTML={{__html: `<pre style="white-space:pre-wrap">${highlightTokens(item.redacted_text) || "—"}</pre>`}}/>
                </div>
              </div>
              <div style={{marginTop:8}}>
                <div><b>Reasons:</b> {(item.reasons || []).join(", ")}</div>
                <div><b>Redactions:</b> {Array.isArray(item.redactions) ? item.redactions.map((r:any)=>`${r.label}:${r.token_id}`).join(", ") : "—"}</div>
              </div>
              <div style={{marginTop:8}}>
                <textarea placeholder="Decision comment" value={comment} onChange={e=>setComment(e.target.value)} rows={3} style={{width:"100%"}}/>
              </div>
              <div style={{marginTop:8, display:"flex", gap:8}}>
                <button onClick={()=>decide("approve")}>Approve</button>
                <button onClick={()=>decide("deny")}>Deny</button>
                <button onClick={()=>decide("escalate")}>Escalate</button>
                <button onClick={()=>{setSelected(null); setItem(null);}}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* ====== New Reviewer Dashboard (Day 13) ====== */}
      <div style={{marginTop: 32}}>
        <ReviewerDashboard baseUrl={API} reviewer={reviewer} region="us_east" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

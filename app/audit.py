import os, json, hashlib, time, base64, io, zipfile
from typing import Any, Dict, List, Optional, Tuple
import psycopg
from psycopg.types.json import Json
from signing import load_or_create_key, verify_key_b64

DB_DSN = (
    f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
)

def _hash_dict(prev_hash: str, record: Dict[str, Any]) -> str:
    m = hashlib.sha256()
    m.update((prev_hash or "").encode("utf-8"))
    m.update(json.dumps(record, sort_keys=True, ensure_ascii=False).encode("utf-8"))
    return m.hexdigest()

def _get_last_hash(cur) -> Tuple[Optional[int], str]:
    cur.execute("SELECT id, this_hash FROM audit_log ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    if not row:
        return None, ""
    return row[0], row[1] or ""

def append_audit(cur, *, actor: str, action: str, region: str, details: Dict[str, Any]) -> int:
    """
    Appends an audit row with prev/this hash + signature (Ed25519 over this_hash).
    Returns the new row id.
    """
    # build the logical payload (stable order)
    base = {
        "ts": time.time(),
        "actor": actor,
        "action": action,
        "region": region,
        "details": details,
    }
    _, prev_hash = _get_last_hash(cur)
    this_hash = _hash_dict(prev_hash, base)

    sk = load_or_create_key()
    sig = sk.sign(this_hash.encode("utf-8")).signature
    sig_b64 = base64.b64encode(sig).decode()

    cur.execute(
        """INSERT INTO audit_log (ts, actor, action, region, details, prev_hash, this_hash)
           VALUES (to_timestamp(%s), %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (base["ts"], actor, action, region, Json(details), prev_hash, this_hash),
    )
    row = cur.fetchone()
    # Store the signature alongside details for export integrity (optional)
    cur.execute(
        "UPDATE audit_log SET details = jsonb_set(details, '{signature_b64}', to_jsonb(%s::text)) WHERE id=%s",
        (sig_b64, row[0])
    )
    return row[0]

def verify_chain(cur) -> Dict[str, Any]:
    """
    Verifies the current DB audit chain (hash continuity + signature validity).
    Returns summary with first_id,last_id,count,root_hash,ok flag.
    """
    from nacl.signing import VerifyKey
    vk = VerifyKey(base64.b64decode(verify_key_b64()))
    cur.execute("SELECT id, ts, actor, action, region, details, prev_hash, this_hash FROM audit_log ORDER BY id ASC")
    rows = cur.fetchall()
    ok = True
    prev = ""
    first_id = rows[0][0] if rows else None
    last_id = rows[-1][0] if rows else None
    count = len(rows)
    for (id_, ts, actor, action, region, details, prev_hash, this_hash) in rows:
        base = {"ts": ts.timestamp() if hasattr(ts, "timestamp") else float(ts), "actor": actor, "action": action, "region": region, "details": details}
        calc = _hash_dict(prev, base)
        if calc != this_hash or prev_hash != prev:
            ok = False
            break

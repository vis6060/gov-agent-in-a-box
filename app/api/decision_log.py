import os, json, hashlib, time, base64
from typing import Dict, Optional
from signing import load_or_create_key

LOG_DIR = "/data/logs"
LOG_PATH = f"{LOG_DIR}/policy_decisions.jsonl"
STATE_PATH = f"{LOG_DIR}/policy_state.json"

os.makedirs(LOG_DIR, exist_ok=True)

def _load_prev_hash() -> str:
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f).get("prev_hash", "")
    except FileNotFoundError:
        return ""

def _save_prev_hash(h: str):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump({"prev_hash": h}, f)

def _hash_record(obj: Dict, prev_hash: str) -> str:
    m = hashlib.sha256()
    m.update(prev_hash.encode())
    m.update(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8"))
    return m.hexdigest()

def append_decision(record: Dict, prev_hash: Optional[str] = None) -> Dict:
    """
    Appends a signed decision record to JSONL with hash-chaining.
    Returns the augmented record ({prev_hash, this_hash, signature_b64} added).
    """
    if prev_hash is None:
        prev_hash = _load_prev_hash()

    # enrich + hash
    rec = dict(record)
    rec.setdefault("ts", time.time())
    rec.setdefault("kind", "policy_decision")
    this_hash = _hash_record(rec, prev_hash)

    # sign
    sk = load_or_create_key()
    signed = sk.sign(this_hash.encode("utf-8"))
    sig_b64 = base64.b64encode(signed.signature).decode()

    # persist
    out = dict(rec, prev_hash=prev_hash, this_hash=this_hash, signature_b64=sig_b64)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(out, ensure_ascii=False) + "\n")
    _save_prev_hash(this_hash)
    return out

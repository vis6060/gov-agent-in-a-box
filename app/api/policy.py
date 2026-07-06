import re, os, time, uuid
from typing import Dict, Any, List, Tuple
import psycopg

SSN_RE   = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
PHONE_RE = re.compile(r"\+?\d[\d\s\-]{7,}\d")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

DB_DSN = (
    f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
    f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
)

class PolicyOutcome:
    # action: "block" | "allow" | "allow_with_redaction"
    def __init__(self, action: str, reasons: List[str], text_after: str, redactions: List[Dict[str, Any]]):
        self.action = action
        self.reasons = reasons
        self.text_after = text_after
        self.redactions = redactions

def _find_pii(text: str) -> List[Tuple[str, re.Pattern, str]]:
    findings = []
    for label, pattern in [("ssn", SSN_RE), ("phone", PHONE_RE), ("email", EMAIL_RE)]:
        for m in pattern.finditer(text or ""):
            findings.append((label, pattern, m.group(0)))
    return findings

def _tokenize_pii(region: str, pii_values: List[str]) -> Dict[str, str]:
    tokens = {}
    if not pii_values:
        return tokens
    expires = time.time() + 60  # 60s rollback demo window
    with psycopg.connect(DB_DSN, autocommit=True) as conn, conn.cursor() as cur:
        for val in pii_values:
            token_id = f"tk_{uuid.uuid4().hex[:12]}"
            tokens[val] = token_id
            cur.execute(
                "INSERT INTO token_vault(token_id, region, plaintext, expires_at) VALUES (%s,%s,%s, to_timestamp(%s))",
                (token_id, region, val, int(expires))
            )
    return tokens

def redact_text(region: str, text: str, findings: List[Tuple[str, re.Pattern, str]]) -> Dict[str, Any]:
    if not findings:
        return {"text": text, "redactions": []}
    unique_vals = list({val for _,_,val in findings})
    mapping = _tokenize_pii(region, unique_vals)
    redactions = []
    redacted = text
    for label, pattern, val in findings:
        token_id = mapping[val]
        redacted = redacted.replace(val, f"[[TOKEN:{token_id}]]")
        redactions.append({"label": label, "value": val, "token_id": token_id})
    return {"text": redacted, "redactions": redactions}

def pre_policy(region: str, user_text: str) -> PolicyOutcome:
    f = _find_pii(user_text)
    if any(lbl == "ssn" for lbl,_,_ in f):
        # Example: block on SSN; you can tune later
        return PolicyOutcome("block", ["ssn_detected"], user_text, [])
    if f:
        r = redact_text(region, user_text, f)
        return PolicyOutcome("allow_with_redaction", ["pii_redacted"], r["text"], r["redactions"])
    return PolicyOutcome("allow", [], user_text, [])

def post_policy(region: str, model_text: str) -> PolicyOutcome:
    # Stub for Day 3. Extend later to check tool outputs for leaks, etc.
    return PolicyOutcome("allow", [], model_text, [])

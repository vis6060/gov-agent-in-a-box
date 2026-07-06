#!/usr/bin/env python3
import json, sys, time, random
from urllib import request, error

API = "http://localhost:8000"

def post_json(path, payload, headers=None, timeout=15):
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{API}{path}",
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "ignore")
            return r.status, (json.loads(body) if body else {})
    except error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        try:
            j = json.loads(body) if body else {}
        except Exception:
            j = {"raw": body}
        return e.code, j
    except Exception as e:
        return -1, {"error": str(e)}

def main():
    src = "sample-data/policy/policy-tests.jsonl"
    if len(sys.argv) > 1:
        src = sys.argv[1]

    # gentle pacing to avoid any per-minute quota
    sleep_sec = 0.25

    n = 0
    with open(src, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            payload = {
                "prompt": rec["prompt"],
                "region": rec.get("region", "us_east"),
                "top_k": 3,
            }

            # Optional jitter
            time.sleep(sleep_sec + random.random()*0.05)

            status, out = post_json("/v1/tasks", payload)

            n += 1
            expect = rec.get("expect")
            note = rec.get("note", "")

            if status == 200:
                print(f"[{n}] {note or 'ok'} -> task_id={out.get('task_id')} status={out.get('status')} pre={out.get('pre_action')}")
            else:
                # Print the error but keep going
                reason = out.get("error") or out.get("detail") or out.get("raw") or out
                print(f"[{n}] ERR {status} for note='{note}': {reason}")

                # Optional backoff if you hit quotas/limits
                if status in (403, 429):
                    time.sleep(1.0)

    print(f"\nSeed attempted {n} tasks from {src}")

if __name__ == "__main__":
    main()

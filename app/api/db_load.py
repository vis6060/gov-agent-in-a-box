import os, json, psycopg
from psycopg.types.json import Json

DB_DSN = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"

def load_jsonl(path):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)

def load_docs(region:str, file_path:str):
    schema = region.replace("-", "_")
    with psycopg.connect(DB_DSN, autocommit=True) as conn:
        with conn.cursor() as cur:
            for rec in load_jsonl(file_path):
                cur.execute(
                    f"""INSERT INTO {schema}.docs (doc_id, department, title, body, version, effective_date)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (doc_id) DO NOTHING""",
                    (rec["doc_id"], rec["department"], rec["title"], rec["body"], rec.get("version"), rec.get("effective_date")),
                )
    print(f"Loaded docs for {region} from {file_path}")

if __name__ == "__main__":
    # paths are mounted at /data
    load_docs("us-east", "/data/seeds/seed_docs_us-east.jsonl")
    load_docs("eu-central", "/data/seeds/seed_docs_eu-central.jsonl")

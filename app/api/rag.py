import os, pickle, time
import psycopg
from typing import List, Dict, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DB_DSN = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
INDEX_DIR = "/data/index"  # persisted volume

class RegionRAG:
    def __init__(self, region: str):
        self.region = region.replace("-", "_")
        self.vectorizer = None
        self.doc_matrix = None
        self.docs: List[Dict] = []

    def _index_path(self):
        path = f"{INDEX_DIR}/{self.region}"
        os.makedirs(path, exist_ok=True)
        return path

    def load_index(self) -> bool:
        p = self._index_path()
        vec_p = f"{p}/tfidf.pkl"
        mat_p = f"{p}/matrix.pkl"
        docs_p = f"{p}/docs.pkl"
        if all(os.path.exists(x) for x in [vec_p, mat_p, docs_p]):
            with open(vec_p, "rb") as f: self.vectorizer = pickle.load(f)
            with open(mat_p, "rb") as f: self.doc_matrix = pickle.load(f)
            with open(docs_p, "rb") as f: self.docs = pickle.load(f)
            return True
        return False

    def save_index(self):
        p = self._index_path()
        with open(f"{p}/tfidf.pkl","wb") as f: pickle.dump(self.vectorizer, f)
        with open(f"{p}/matrix.pkl","wb") as f: pickle.dump(self.doc_matrix, f)
        with open(f"{p}/docs.pkl","wb") as f: pickle.dump(self.docs, f)

    def build_from_db(self):
        with psycopg.connect(DB_DSN, autocommit=True) as conn, conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            cur.execute(f"SELECT doc_id, department, title, body FROM {self.region}.docs ORDER BY doc_id")
            rows = cur.fetchall()
        self.docs = rows
        corpus = [f"{r['title']}. {r['body']}" for r in rows]
        if not corpus:
            # keep empty model but prevent errors
            self.vectorizer = TfidfVectorizer(stop_words='english')
            self.doc_matrix = self.vectorizer.fit_transform(["placeholder"])
            self.docs = [{"doc_id":"none","title":"No docs indexed","body":"Add docs and reindex"}]
            return
        self.vectorizer = TfidfVectorizer(stop_words='english')
        self.doc_matrix = self.vectorizer.fit_transform(corpus)
        self.save_index()

    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        if self.vectorizer is None or self.doc_matrix is None:
            if not self.load_index():
                self.build_from_db()
        q = self.vectorizer.transform([query])
        sims = cosine_similarity(q, self.doc_matrix)[0]
        idx = sims.argsort()[::-1][:top_k]
        out = []
        for i in idx:
            d = self.docs[i]
            out.append({"doc_id": d["doc_id"], "title": d["title"], "department": d["department"], "score": float(sims[i])})
        return out

# simple manager cache
_rag_cache: Dict[str, RegionRAG] = {}

def get_rag(region:str) -> RegionRAG:
    key = region.replace("-", "_")
    if key not in _rag_cache:
        _rag_cache[key] = RegionRAG(key)
        _rag_cache[key].load_index()  # lazy
    return _rag_cache[key]

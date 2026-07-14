import numpy as np

from app.rag.store import VectorStore


class FakeModel:
    """Deterministic 8-dim embedding: hash of chars into buckets."""

    def encode(self, texts):
        out = []
        for t in texts:
            v = np.zeros(8, dtype=np.float32)
            for ch in t:
                v[ord(ch) % 8] += 1.0
            out.append(v)
        return np.asarray(out)


def make_store():
    return VectorStore(model_name="fake", _model=FakeModel())


def test_search_returns_ranked_hits():
    s = make_store()
    s.add(["แมวนั่งบนเสื่อ", "หมาวิ่งในสวน"], metas=[{"section": "ม.1"}, {"section": "ม.2"}])
    hits = s.search("แมวนั่งบนเสื่อ", k=1)
    assert hits[0]["section"] == "ม.1"
    assert hits[0]["score"] > 0.9


def test_save_and_load_roundtrip(tmp_path):
    s = make_store()
    s.add(["หนึ่ง", "สอง"], metas=[{"section": "a"}, {"section": "b"}])
    s.save(tmp_path / "store")
    loaded = VectorStore.load(tmp_path / "store", _model=FakeModel())
    assert len(loaded.chunks) == 2
    hits = loaded.search("หนึ่ง", k=2)
    assert len(hits) == 2


def test_empty_store_search():
    assert make_store().search("อะไรก็ได้") == []

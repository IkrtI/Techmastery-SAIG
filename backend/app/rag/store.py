"""Minimal persistent vector store: normalized embeddings + jsonl chunks.

Law corpus is a few hundred chunks — numpy dot product beats running a vector DB.
"""
import json
import os
from pathlib import Path

import numpy as np

DEFAULT_EMBED_MODEL = os.environ.get("RAILGUARD_EMBED_MODEL", "BAAI/bge-m3")


class VectorStore:
    def __init__(self, model_name=DEFAULT_EMBED_MODEL, _model=None):
        self.model_name = model_name
        self._model = _model  # injectable for tests
        self.embeddings = np.zeros((0, 0), dtype=np.float32)
        self.chunks = []  # list of dicts: {text, section, ...}

    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def _encode(self, texts):
        vecs = np.asarray(self.model.encode(texts), dtype=np.float32)
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        return vecs / np.clip(norms, 1e-9, None)

    def add(self, texts, metas=None):
        metas = metas or [{} for _ in texts]
        vecs = self._encode(list(texts))
        if self.embeddings.size == 0:
            self.embeddings = vecs
        else:
            self.embeddings = np.vstack([self.embeddings, vecs])
        for text, meta in zip(texts, metas):
            self.chunks.append({"text": text, **meta})

    def search(self, query, k=4):
        if not self.chunks:
            return []
        qv = self._encode([query])[0]
        scores = self.embeddings @ qv
        order = np.argsort(-scores)[:k]
        return [{**self.chunks[i], "score": float(scores[i])} for i in order]

    def save(self, dir_path):
        d = Path(dir_path)
        d.mkdir(parents=True, exist_ok=True)
        np.save(d / "embeddings.npy", self.embeddings)
        with open(d / "chunks.jsonl", "w", encoding="utf-8") as f:
            for c in self.chunks:
                f.write(json.dumps(c, ensure_ascii=False) + "\n")
        (d / "meta.json").write_text(json.dumps({"model": self.model_name}))

    @classmethod
    def load(cls, dir_path, _model=None):
        d = Path(dir_path)
        meta = json.loads((d / "meta.json").read_text())
        store = cls(model_name=meta["model"], _model=_model)
        store.embeddings = np.load(d / "embeddings.npy")
        with open(d / "chunks.jsonl", encoding="utf-8") as f:
            store.chunks = [json.loads(line) for line in f]
        return store

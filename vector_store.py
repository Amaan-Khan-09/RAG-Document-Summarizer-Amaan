# vector_store.py
#
# A minimal, dependency-light replacement for chromadb's PersistentClient +
# Collection, used only because ChromaDB's actual footprint (onnxruntime,
# gRPC, protobuf, OpenTelemetry, a Kubernetes client -- all for features
# this app never uses, since embeddings are always supplied by the caller,
# never Chroma's own embedding functions) made cold starts on a CPU-
# throttled free-tier host take longer than the hosting platform's own
# gateway timeout. At this app's scale (hundreds of chunks, not millions),
# a plain numpy cosine-similarity scan is effectively instant -- no
# approximate-nearest-neighbor index needed at all.
#
# Exposes just the four operations rag_engine.py actually calls, with the
# same return shapes chromadb used, so rag_engine.py needed no changes
# beyond swapping what it imports and constructs.

import os
import pickle
import numpy as np


class VectorStore:
    def __init__(self, persist_dir="./chroma_db"):
        self.persist_dir = persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        self._path = os.path.join(persist_dir, "store.pkl")
        # {id: {"embedding": np.ndarray, "document": str, "metadata": dict}}
        self._records = {}
        self._load()

    def _load(self):
        if os.path.exists(self._path):
            with open(self._path, "rb") as f:
                self._records = pickle.load(f)

    def _save(self):
        with open(self._path, "wb") as f:
            pickle.dump(self._records, f)

    @staticmethod
    def _matches(metadata, where):
        if not where:
            return True
        for key, condition in where.items():
            value = metadata.get(key)
            if isinstance(condition, dict) and "$in" in condition:
                if value not in condition["$in"]:
                    return False
            elif value != condition:
                return False
        return True

    def upsert(self, ids, embeddings, documents, metadatas):
        for id_, embedding, document, metadata in zip(ids, embeddings, documents, metadatas):
            self._records[id_] = {
                "embedding": np.asarray(embedding, dtype=np.float32),
                "document": document,
                "metadata": metadata,
            }
        self._save()

    def query(self, query_embeddings, n_results=5, include=None, where=None):
        query_vec = np.asarray(query_embeddings[0], dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)

        scored = []
        for record in self._records.values():
            if not self._matches(record["metadata"], where):
                continue
            emb = record["embedding"]
            denom = query_norm * np.linalg.norm(emb)
            similarity = float(np.dot(query_vec, emb) / denom) if denom else 0.0
            distance = 1 - similarity
            scored.append((distance, record))

        scored.sort(key=lambda pair: pair[0])
        top = scored[:n_results]

        return {
            "documents": [[r["document"] for _, r in top]],
            "metadatas": [[r["metadata"] for _, r in top]],
            "distances": [[d for d, _ in top]],
        }

    def get(self, where=None):
        matching = [
            (id_, r) for id_, r in self._records.items() if self._matches(r["metadata"], where)
        ]
        return {
            "ids": [id_ for id_, _ in matching],
            "documents": [r["document"] for _, r in matching],
            "metadatas": [r["metadata"] for _, r in matching],
        }

    def delete(self, where=None, ids=None):
        if ids is not None:
            for id_ in ids:
                self._records.pop(id_, None)
        elif where is not None:
            to_remove = [id_ for id_, r in self._records.items() if self._matches(r["metadata"], where)]
            for id_ in to_remove:
                self._records.pop(id_, None)
        else:
            self._records.clear()
        self._save()

    def count(self):
        return len(self._records)

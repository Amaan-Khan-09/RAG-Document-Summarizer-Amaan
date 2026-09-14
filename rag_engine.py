# rag_engine.py


import os
import chromadb
from pypdf import PdfReader
from docx import Document
import hashlib
from concurrent.futures import ThreadPoolExecutor

import llm_provider

EMBED_WORKERS = 8

class RAGEngine:
    def __init__(self, persist_dir="./chroma_db"):
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=chromadb.config.Settings(anonymized_telemetry=False),
        )

        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"},
        )

    def extract_text(self, filepath):
        """Extract text from PDF, DOCX, or TXT files"""
        ext = os.path.splitext(filepath)[1].lower()

        if ext == '.pdf':
            reader = PdfReader(filepath)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text

        elif ext == '.docx':
            doc = Document(filepath)
            return "\n".join([para.text for para in doc.paragraphs])

        elif ext == '.txt':
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()

        else:
            raise ValueError(f"Unsupported file type: {ext}")

    def chunk_text(self, text, chunk_size=1000, overlap=200):
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        text_len = len(text)

        while start < text_len:
            end = start + chunk_size
            chunk = text[start:end]

            if chunk.strip():
                chunks.append(chunk)

            start += (chunk_size - overlap)

        return chunks

    def add_document(self, filepath, filename):
        """Process and add document to vector database.

        Raises ValueError if the file has no extractable text (e.g. a
        scanned/image-only PDF) so the caller can report a clear error
        instead of silently indexing zero chunks.
        """
        text = self.extract_text(filepath)

        if not text or not text.strip():
            raise ValueError(
                "No extractable text found in this file (it may be a scanned "
                "image, empty, or corrupted)."
            )

        chunks = self.chunk_text(text)
        doc_id = hashlib.md5(filename.encode()).hexdigest()

        # Re-uploading a file with the same name previously crashed / silently
        # no-opped because collection.add() rejects ids that already exist.
        # Clear out any prior chunks for this filename first so re-uploads are
        # idempotent (upsert semantics at the document level).
        self.collection.delete(where={"filename": filename})

        # Dispatched concurrently on the client side. Measured on Ollama with
        # an 87-chunk PDF: this made ~no difference (34.5s vs 35.8s
        # sequential), because this machine's Ollama has
        # OLLAMA_NUM_PARALLEL=1, which serializes inference server-side
        # regardless of how many requests arrive at once. Left in place
        # (harmless there, and a real win both on a server configured with
        # OLLAMA_NUM_PARALLEL>1 and on Gemini, which does serve concurrent
        # requests) -- see README for the honest before/after numbers.
        embed_document_chunk = lambda chunk: llm_provider.embed(chunk, task_type="RETRIEVAL_DOCUMENT")
        with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as pool:
            embeddings = list(pool.map(embed_document_chunk, chunks))

        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        documents = chunks
        metadatas = [{"filename": filename, "chunk_index": i} for i in range(len(chunks))]

        if ids:
            self.collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
            )

        return len(chunks)

    def query(self, question, n_results=5):
        """Query the vector database (non-streaming)."""
        sources, prompt = self._build_query_prompt(question, n_results)
        if prompt is None:
            return None, []

        return llm_provider.generate(prompt), sources

    def query_stream(self, question, n_results=5):
        """Query the vector database, yielding response tokens as they're
        generated. Yields ("sources", list[dict]) once, then ("token", str)
        for each generated piece. Each source dict is
        {filename, snippet, similarity} so the UI can show *what* was
        actually retrieved, not just claim a filename was relevant."""
        sources, prompt = self._build_query_prompt(question, n_results)
        if prompt is None:
            yield ("error", "No documents found. Please upload documents first.")
            return

        yield ("sources", sources)
        for token in llm_provider.generate_stream(prompt):
            yield ("token", token)

    def _build_query_prompt(self, question, n_results):
        query_embedding = llm_provider.embed(question, task_type="RETRIEVAL_QUERY")

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )

        if not results['documents'][0]:
            return [], None

        context = "\n\n".join(results['documents'][0])

        # Keep the single best-scoring chunk per filename as its citation
        # snippet, so a source in the UI can show *what* was retrieved, not
        # just that the filename was involved somewhere.
        best_by_file = {}
        for doc, meta, distance in zip(
            results['documents'][0], results['metadatas'][0], results['distances'][0]
        ):
            filename = meta['filename']
            similarity = 1 - distance  # cosine distance -> similarity
            if filename not in best_by_file or similarity > best_by_file[filename]['similarity']:
                snippet = doc.strip().replace('\n', ' ')
                if len(snippet) > 220:
                    snippet = snippet[:220].rsplit(' ', 1)[0] + '...'
                best_by_file[filename] = {
                    "filename": filename,
                    "snippet": snippet,
                    "similarity": round(similarity, 3),
                }

        sources = sorted(best_by_file.values(), key=lambda s: -s['similarity'])

        prompt = f"""Based on the following context from multiple documents, answer the question accurately and concisely.

Context:
{context}

Question: {question}

Answer (be specific and cite which document if relevant):"""

        return sources, prompt

    def summarize(self, filename=None):
        """Generate summary of documents (non-streaming)."""
        prompt = self._build_summary_prompt(filename)
        if prompt is None:
            return "No documents found."

        return llm_provider.generate(prompt)

    def summarize_stream(self, filename=None):
        """Generate summary of documents, yielding tokens as they arrive."""
        prompt = self._build_summary_prompt(filename)
        if prompt is None:
            yield ("error", "No documents found.")
            return

        for token in llm_provider.generate_stream(prompt):
            yield ("token", token)

    def _build_summary_prompt(self, filename=None):
        if filename:
            results = self.collection.get(where={"filename": filename})
        else:
            results = self.collection.get()

        if not results['documents']:
            return None

        # Get more chunks for better summary
        sample_text = "\n".join(results['documents'][:20])

        return f"""Summarize the following document content in 5-7 bullet points, highlighting the main points and key information:

{sample_text}

Summary:"""

    def list_documents(self):
        """List distinct uploaded documents with their chunk counts."""
        results = self.collection.get()
        counts = {}
        for meta in results.get('metadatas', []) or []:
            filename = meta.get('filename', 'unknown')
            counts[filename] = counts.get(filename, 0) + 1
        return [
            {"filename": filename, "chunks": count}
            for filename, count in sorted(counts.items())
        ]

    def delete_document(self, filename):
        """Delete all chunks belonging to a single document."""
        existing = self.collection.get(where={"filename": filename})
        if not existing.get('ids'):
            return False
        self.collection.delete(where={"filename": filename})
        return True

    def get_stats(self):
        """Get database statistics"""
        count = self.collection.count()
        doc_count = len(self.list_documents())
        return {"total_chunks": count, "total_documents": doc_count}

    def clear_all(self):
        """Delete every chunk from the collection."""
        existing_ids = self.collection.get().get('ids', [])
        if existing_ids:
            self.collection.delete(ids=existing_ids)

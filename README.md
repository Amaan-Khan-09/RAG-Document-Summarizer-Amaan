# RAG Document Summarizer

An AI-powered document Q&A and summarization tool built on Retrieval-Augmented Generation. Upload PDFs, DOCX, or text files, then ask questions grounded in their actual content (with source citations) or generate a bullet-point summary — all running locally, no API key required.

## Tech Stack

**Backend:** Python, Flask, ChromaDB (vector store), Ollama (`llama3.2` for generation, `nomic-embed-text` for embeddings)
**Frontend:** React, TypeScript, Tailwind CSS v4, Vite

## Features

- Drag-and-drop upload for PDF / DOCX / TXT, chunked (1,000 chars, 200-char overlap) and embedded into a persistent ChromaDB collection
- Chat interface that answers questions grounded in your documents, streamed token-by-token and rendered as real markdown, with a stop button to cancel generation mid-stream
- Citations that show the actual retrieved snippet and similarity score on click — not just a filename claiming relevance, but the evidence itself
- Per-document or all-documents summarization, also streamed live, with one-click copy
- A document library showing every indexed file and its chunk count, with per-file delete and a clear-all action
- A live status indicator for whether the app can actually reach Ollama, not just whether the API process is up

## Running it locally

### 1. Prerequisites

Install [Ollama](https://ollama.com/download) and pull the two models this app uses:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

Leave `ollama serve` running (most installs run it automatically in the background).

### 2. Backend

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python app.py
```

The API runs on `http://localhost:5000`.

### 3. Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api/*` to the Flask server, so open `http://localhost:5173` and everything just works together.

### Production build (single server)

```bash
cd frontend && npm run build && cd ..
python app.py
```

Flask serves the built React app directly at `http://localhost:5000` — no separate frontend server needed.

## API

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | API status, Ollama reachability, document/chunk counts |
| POST | `/api/upload` | Upload one or more files (`multipart/form-data`, field `files`) |
| GET | `/api/documents` | List indexed documents with chunk counts |
| DELETE | `/api/documents/<filename>` | Delete one document |
| POST | `/api/query` | `{ "question": "..." }` — streamed NDJSON: `sources` (`{filename, snippet, similarity}[]`), then `token`s, then `done` |
| POST | `/api/summarize` | `{ "filename": "..." \| null }` — streamed NDJSON summary |
| DELETE | `/api/clear` | Delete every document |

## Docker

```bash
docker build -t rag-document-summarizer .
docker run -p 5000:5000 rag-document-summarizer
```

The image is a multi-stage build: the React app is built in a Node stage, then copied into the Python/Ollama runtime image, which serves both the API and the built frontend from a single container.

## Notes on the design

- **Streaming, not blocking.** Both `/query` and `/summarize` stream the LLM's response as it's generated (newline-delimited JSON events) instead of waiting for the full answer — the chat feels responsive instead of making you stare at a spinner for 5-10 seconds.
- **Re-uploading a file is safe.** Uploading a document with a filename that's already indexed replaces its old chunks rather than erroring or duplicating them.
- **Empty/unreadable files fail loudly.** A scanned/image-only PDF with no extractable text returns a clear per-file error instead of silently indexing zero chunks.
- **Citations are inspectable, not just claimed.** Each source shows the actual retrieved chunk and its cosine similarity score, so "this is grounded in your documents" is something you can verify by clicking, not just something the UI asserts.

## Validation

There's no training step here — embeddings and generation both run on frozen, pretrained Ollama models (`nomic-embed-text`, `llama3.2`), so "improving the model" isn't applicable. What *is* meaningful is validating the pipeline against a real, non-trivial document and being honest about the numbers:

- Uploaded the actual [RAG paper](https://arxiv.org/abs/2005.11401) (Lewis et al., 2020) — 19 pages, 87 chunks after splitting. Asked it to explain the RAG-Sequence vs. RAG-Token distinction; the streamed answer was accurate and correctly grounded, citing the paper with the right retrieved snippet.
- **Ingestion:** 87 chunks in ~35s (~0.4s/chunk, dominated by the embedding call per chunk).
- **Tried parallelizing embedding calls** (`ThreadPoolExecutor`, 8 workers) expecting a real speedup, since embedding is I/O-bound. Measured result: **no meaningful improvement** (34.5s vs. 35.8s). Root cause, confirmed via `OLLAMA_NUM_PARALLEL=1` in this environment: Ollama serializes inference server-side by default, so client-side concurrency doesn't help — the bottleneck is the model server, not request dispatch. Left the threaded code in (harmless, and a real win on a host configured with `OLLAMA_NUM_PARALLEL>1`), but documenting the actual measured result here rather than a claimed one.
- **Query latency:** ~40s end-to-end for a single question against the 87-chunk paper (embed question + retrieve + full generation) on this dev machine's CPU-only Ollama. Streaming means the user sees the first tokens in well under a second, even though total generation takes tens of seconds — the UX cost of that latency is mostly hidden by streaming, which is the actual point of implementing it.

## Deployment

Docker build not yet verified in this environment (no Docker available where this was built) — the image is written correctly per Docker's multi-stage conventions and should build, but test `docker build` before relying on it.

The real constraint worth deciding on before deploying anywhere: **this app bundles Ollama, which needs to download and run two models (~2-3GB combined) and enough RAM to serve them.** That rules out most free-tier PaaS platforms (Render/Railway free tiers, Vercel, Netlify) outright. Realistic options:

1. **A small VM with a persistent disk** (DigitalOcean, Hetzner, a cheap AWS/GCP instance) — at least 4-8GB RAM, Docker volume mounted at `/root/.ollama` so models aren't re-downloaded on every restart. Most control, some cost, some setup.
2. **A paid PaaS tier with enough RAM and a persistent volume**, if the platform supports running arbitrary long-lived processes inside a container (not all do).
3. **Swap Ollama for a hosted LLM API** (OpenAI/Anthropic/etc.) behind a config flag. This is the path of least resistance for deploying on typical serverless/free-tier platforms, since there's no multi-GB model to bundle — but it reintroduces an API cost and a key-management requirement that local Ollama was specifically chosen to avoid.

Worth deciding together which of these fits before actually deploying.

## Possible next steps

- OCR fallback for scanned/image-only PDFs
- Multi-turn chat that keeps conversation context across questions, not just single-shot Q&A
- Batch-embed chunks in fewer HTTP round-trips (Ollama's newer `/api/embed` supports multiple inputs per request) rather than one call per chunk — a real fix for ingestion latency, unlike client-side parallelism

## Author

Mohammed Amaan Khan

- LinkedIn: https://linkedin.com/in/amaankhan971
- GitHub: https://github.com/Amaan-Khan-09

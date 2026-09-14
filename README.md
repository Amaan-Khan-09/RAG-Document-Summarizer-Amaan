# RAG Document Summarizer

An AI-powered document Q&A and summarization tool built on Retrieval-Augmented Generation. Upload PDFs, DOCX, or text files, then ask questions grounded in their actual content (with source citations) or generate a bullet-point summary.

Chat/generation and embeddings are independently swappable, controlled by env vars: **fully local via Ollama** for development (no API key, no cost), or **Groq for chat + Gemini for embeddings** in the deployed version. That split exists because Groq — chosen for chat since it's free-tier and extremely fast — has no embeddings API at all; Gemini fills that one gap.

## Tech Stack

**Backend:** Python, Flask, ChromaDB (vector store), a swappable provider layer — Ollama (`llama3.2` + `nomic-embed-text`) locally; Groq (`llama-3.3-70b-versatile`) for chat + Gemini (`gemini-embedding-001`) for embeddings in production
**Frontend:** React, TypeScript, Tailwind CSS v4, Vite

## Features

- Drag-and-drop upload for PDF / DOCX / TXT, chunked (1,000 chars, 200-char overlap) and embedded into a persistent ChromaDB collection
- Chat interface that answers questions grounded in your documents, streamed token-by-token and rendered as real markdown, with a stop button to cancel generation mid-stream
- Citations that show the actual retrieved snippet and similarity score on click — not just a filename claiming relevance, but the evidence itself
- Per-document or all-documents summarization, also streamed live, with one-click copy
- A document library showing every indexed file and its chunk count, with per-file delete and a clear-all action
- A live status indicator for whether the app can actually reach the active LLM provider, not just whether the API process is up
- Rate limiting and a shared-secret gate on every API-cost-incurring route, so a public deployment can't be hit directly (bypassing the frontend) to burn through the API key's quota

## Running it locally

### 1. Prerequisites

By default the app uses local Ollama — install it and pull the two models this app uses:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

Leave `ollama serve` running (most installs run it automatically in the background). No API key needed for local dev.

To run locally against the same providers the deployed version uses:

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key       # embeddings only -- EMBED_PROVIDER defaults to
                                      # "gemini" automatically when LLM_PROVIDER=groq
```

Or mix and match — e.g. Groq for fast chat while still embedding locally with Ollama (no Gemini key needed at all):

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=your-groq-key
EMBED_PROVIDER=ollama
```

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

Routes marked 🔒 require an `X-App-Secret` header when `APP_SECRET` is set (see Cost & abuse protection below) — unenforced in local dev, where that env var isn't set.

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | API status, LLM provider reachability, document/chunk counts |
| POST | `/api/upload` 🔒 | Upload one or more files (`multipart/form-data`, field `files`) |
| GET | `/api/documents` | List indexed documents with chunk counts |
| DELETE | `/api/documents/<filename>` 🔒 | Delete one document |
| POST | `/api/query` 🔒 | `{ "question": "..." }` — streamed NDJSON: `sources` (`{filename, snippet, similarity}[]`), then `token`s, then `done` |
| POST | `/api/summarize` 🔒 | `{ "filename": "..." \| null }` — streamed NDJSON summary |
| DELETE | `/api/clear` 🔒 | Delete every document |

## Docker (local, Ollama-only path)

```bash
docker build -f Dockerfile.ollama-local -t rag-document-summarizer .
docker run -p 5000:5000 rag-document-summarizer
```

The image is a multi-stage build: the React app is built in a Node stage, then copied into the Python/Ollama runtime image, which serves both the API and the built frontend from a single container.

Deliberately *not* named `Dockerfile` — Render (and several other PaaS platforms) auto-detect a file with that exact name and default to a Docker-based deploy over their native Python buildpack, which would install and try to start Ollama on a free-tier host with no room for it. Renaming it avoids that trap entirely for the Render deployment below, which uses the native Python runtime instead.

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
- **The Groq + Gemini production path was validated live**, not just written to spec: real upload through Gemini embeddings, real question through Groq, both against real API keys. Same question ("who leads the project and what is the next milestone?") that took Ollama tens of seconds on this machine came back **fully generated in 2.2 seconds** through Groq — accurate, correctly grounded, correctly cited. One real bug this surfaced: the model name from Groq's own docs at the time (`llama-3.3-70b-versatile`) returned a 404 — their model catalog had already moved past it. Fixed by querying `client.models.list()` against the real key to find what's actually available now (`openai/gpt-oss-20b`), rather than trusting docs that can go stale.

## Deployment

**Chosen architecture: both frontend and backend on Render (two free services, one account), Groq (chat) + Gemini (embeddings) instead of Ollama in production.** Reasoning, not just a preference:

- The backend needs a real, long-running process (to hold the ChromaDB connection and stream responses) and a persistent-enough filesystem for ChromaDB's on-disk storage — Render's free web services support that; stateless serverless platforms (Vercel, Netlify) don't.
- The frontend is a static build, and Render's free static-site hosting (CDN + SSL, no credit card, no Dockerfile) covers that natively, same as Vercel would — no need for a second platform/account just for that.
- Render's free tier has no GPU and only 512MB RAM/0.1 CPU — no local model would fit — so the deployed backend swaps to hosted providers. Groq was picked for chat specifically for its free tier and very fast streaming; it has no embeddings API at all, so Gemini's cheap embedding model (~$0.003 to embed a 19-page paper, per the Validation numbers below) fills that one gap. Local development is unaffected; it still defaults to Ollama for both.

### Backend (Render Web Service)

1. New Web Service → connect this repo.
2. Build command: `pip install -r requirements.txt`
3. Start command:
   ```
   gunicorn --workers 1 --threads 4 --timeout 120 --graceful-timeout 30 --max-requests 200 --max-requests-jitter 50 app:app
   ```
   Not `python app.py` — that runs Flask's built-in dev server, which explicitly warns against production use. One worker with several threads (not several worker processes) because Render's free tier is only 512MB RAM and each additional worker process would duplicate the ChromaDB connection in memory. `--max-requests` recycles the worker periodically (standard production hardening against any slow resource creep over a long-running process); the jitter staggers it so it doesn't recycle at a perfectly predictable interval.
4. Environment variables:
   - `LLM_PROVIDER=groq`
   - `GROQ_API_KEY=<your key>` (set as a Render secret, never committed)
   - `GEMINI_API_KEY=<your key>` (embeddings only — `EMBED_PROVIDER` defaults to `gemini` automatically when `LLM_PROVIDER=groq`)
   - `ALLOWED_ORIGIN=<your Render static site URL>` (once you have it, so CORS only allows your actual frontend)
   - `APP_SECRET=<any random string you generate>` — see Cost & abuse protection below
5. Render provides a public URL like `https://your-app.onrender.com` — the API is at `https://your-app.onrender.com/api/...`.

### Frontend (Render Static Site)

1. New Static Site → connect this repo, set the root directory to `frontend/`.
2. Build command: `npm run build`, publish directory: `dist`.
3. Environment variables (set before building, Render applies these at build time same as Vercel would):
   - `VITE_API_BASE_URL=https://your-app.onrender.com/api`
   - `VITE_APP_SECRET=<the same random string you set as APP_SECRET on the backend service>`
4. Deploy. Render serves the built static app from its own URL; every API call goes to the backend Web Service.

### Cost & abuse protection

Once `LLM_PROVIDER=groq` is set, every upload spends Gemini embedding quota and every question/summary spends Groq quota — and the Render URL is public, so anyone who finds it could hit the API directly with curl/Postman regardless of what the frontend does. CORS doesn't stop that; CORS is a browser-only mechanism. Two layers guard against it:

- **`APP_SECRET`** — `/api/upload`, `/api/query`, `/api/summarize`, `/api/clear`, and single-document delete all require an `X-App-Secret` header matching this value (skipped entirely if the env var isn't set, so local dev stays frictionless). Worth being honest about what this actually is: once the frontend is built, `VITE_APP_SECRET` ships inside the public JS bundle — anyone who opens devtools on the deployed site can read it out. It's not a real secret against a determined person; its actual job is filtering out automated scanners and casual poking at the bare backend URL that never load the frontend at all.
- **Rate limiting** (`flask-limiter`) — 10 uploads/hour and 20 questions-or-summaries/hour per IP, regardless of whether the secret is known. This is the real backstop: even if `APP_SECRET` leaks, damage is capped.

For a hard ceiling beyond both of these, set a budget alert (or a hard cap) on both keys directly — Groq's console and Google Cloud Console for Gemini — that's the one guarantee that isn't dependent on this app's code being correct.

### Known limitation of this split

Render's free tier spins the backend down after ~15 minutes idle; the next request pays a 30-60s cold-start cost. Not a hard usage cap, just worth hitting the health endpoint once before a live demo to warm it up.

`Dockerfile.ollama-local` (for the local-Ollama, single-container path) is written but not verified in this environment — no Docker available where this was built. Test `docker build -f Dockerfile.ollama-local .` before relying on it if you go that route instead.

## Possible next steps

- OCR fallback for scanned/image-only PDFs
- Multi-turn chat that keeps conversation context across questions, not just single-shot Q&A
- Batch-embed chunks in fewer HTTP round-trips (Ollama's newer `/api/embed` supports multiple inputs per request) rather than one call per chunk — a real fix for ingestion latency, unlike client-side parallelism

## Author

Mohammed Amaan Khan

- LinkedIn: https://linkedin.com/in/amaankhan971
- GitHub: https://github.com/Amaan-Khan-09

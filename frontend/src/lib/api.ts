import type { DocumentInfo, HealthStatus, NdjsonEvent, UploadResult } from '../types'

// Local dev / single-host deploy: relative '/api', proxied by Vite or served
// by the same Flask process. Split deploy (this app's frontend on Vercel,
// backend elsewhere): set VITE_API_BASE_URL to the backend's full URL at
// build time, e.g. VITE_API_BASE_URL=https://your-backend.onrender.com/api
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// Sent as X-App-Secret on every request when the backend has APP_SECRET set.
// Note this is NOT a real secret once built -- it ships inside the public JS
// bundle, readable by anyone who opens devtools on the deployed site. Its
// actual job is filtering out automated/casual abuse of the bare backend
// URL (bots, URL scanners) that never load this frontend at all; the rate
// limit on the backend is the real cost backstop, not this header.
const APP_SECRET = import.meta.env.VITE_APP_SECRET

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return APP_SECRET ? { ...extra, 'X-App-Secret': APP_SECRET } : extra
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`)
  return json<HealthStatus>(res)
}

export async function getDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/documents`)
  const data = await json<{ documents: DocumentInfo[] }>(res)
  return data.documents
}

export async function uploadFiles(files: File[]): Promise<UploadResult[]> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const data = await json<{ results: UploadResult[] }>(res)
  return data.results
}

export async function deleteDocument(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  await json(res)
}

export async function clearAll(): Promise<void> {
  const res = await fetch(`${API_BASE}/clear`, { method: 'DELETE', headers: authHeaders() })
  await json(res)
}

/** Reads an NDJSON streaming response line-by-line, invoking `onEvent` for each. */
async function consumeNdjsonStream(
  res: Response,
  onEvent: (event: NdjsonEvent) => void,
): Promise<void> {
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      onEvent(JSON.parse(line) as NdjsonEvent)
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as NdjsonEvent)
  }
}

export async function streamQuery(
  question: string,
  onEvent: (event: NdjsonEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
    signal,
  })
  await consumeNdjsonStream(res, onEvent)
}

export async function streamSummarize(
  filename: string | null,
  onEvent: (event: NdjsonEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/summarize`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ filename }),
    signal,
  })
  await consumeNdjsonStream(res, onEvent)
}

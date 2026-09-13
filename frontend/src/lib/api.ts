import type { DocumentInfo, HealthStatus, NdjsonEvent, UploadResult } from '../types'

const API_BASE = '/api'

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
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
  const data = await json<{ results: UploadResult[] }>(res)
  return data.results
}

export async function deleteDocument(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
  await json(res)
}

export async function clearAll(): Promise<void> {
  const res = await fetch(`${API_BASE}/clear`, { method: 'DELETE' })
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
    signal,
  })
  await consumeNdjsonStream(res, onEvent)
}

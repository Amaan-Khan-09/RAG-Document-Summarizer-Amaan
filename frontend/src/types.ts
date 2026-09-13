export interface DocumentInfo {
  filename: string
  chunks: number
}

export interface HealthStatus {
  status: string
  ollama_connected: boolean
  total_chunks: number
  total_documents: number
}

export interface UploadResult {
  filename: string
  status: 'success' | 'failed'
  chunks_created?: number
  error?: string
}

export interface Source {
  filename: string
  snippet: string
  similarity: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isStreaming?: boolean
  error?: string
}

export type NdjsonEvent =
  | { type: 'sources'; data: Source[] }
  | { type: 'token'; data: string }
  | { type: 'error'; data: string }
  | { type: 'done'; data: null }
